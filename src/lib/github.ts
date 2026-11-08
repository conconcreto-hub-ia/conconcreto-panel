import "server-only";
// El avance de cada app, leído de su repo en GitHub. Solo lectura.
//
// GITHUB_TOKEN: un token fine-grained de la organización, con permiso de solo lectura sobre
// Contents, Metadata e Issues (el estado del commit sale con Contents). Sin token, el panel funciona igual y dice que no hay avance.
// Las respuestas se guardan 5 minutos (revalidate): el panel no sondea nada de fondo.

const API = "https://api.github.com";
const CACHE_S = 300;

export type Commit = { sha: string; mensaje: string; autor: string; fecha: string; url: string };
export type Tarea = { numero: number; titulo: string; abierta: boolean; url: string; etiquetas: string[]; fecha: string };
export type Hito = { titulo: string; abiertas: number; cerradas: number; vence: string | null; url: string };
export type Despliegue = { estado: string; fecha: string; url: string | null };

export type Avance = {
  ok: true;
  urlRepo: string;
  commits: Commit[];
  commitsPorSemana: number[]; // las últimas 8 semanas, la más vieja primero
  tareasAbiertas: number;
  tareasCerradas: number;
  tareas: Tarea[];
  hitos: Hito[];
  despliegue: Despliegue | null;
} | { ok: false; motivo: string };

async function gh<T>(ruta: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("sin-token");
  const r = await fetch(`${API}${ruta}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    next: { revalidate: CACHE_S },
  });
  if (r.status === 404) throw new Error("no-existe");
  if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
  return r.json() as Promise<T>;
}

/** Cuántos commits cayeron en cada una de las últimas `semanas` semanas. Puro, para probarlo. */
export function porSemana(fechas: string[], ahora: Date, semanas = 8): number[] {
  const out = new Array(semanas).fill(0);
  const SEM = 7 * 86_400_000;
  for (const f of fechas) {
    const atras = Math.floor((ahora.getTime() - new Date(f).getTime()) / SEM);
    if (atras >= 0 && atras < semanas) out[semanas - 1 - atras]++;
  }
  return out;
}

type GhCommit = { sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } }; author: { login: string } | null };
type GhIssue = { number: number; title: string; state: string; html_url: string; labels: { name: string }[]; updated_at: string; pull_request?: unknown };
type GhMilestone = { title: string; open_issues: number; closed_issues: number; due_on: string | null; html_url: string };
type GhEstadoCommit = { state: string; statuses: { context: string; state: string; updated_at: string; target_url: string | null }[] };

export async function avance(repo: string | null): Promise<Avance> {
  if (!repo) return { ok: false, motivo: "Todavía no tiene repo en GitHub." };
  if (!process.env.GITHUB_TOKEN) return { ok: false, motivo: "El panel aún no tiene permiso de lectura en GitHub." };
  try {
    const desde = new Date(Date.now() - 8 * 7 * 86_400_000).toISOString();
    // La publicación: Vercel la deja como estado («Vercel») del último commit de la rama principal.
    const [commits, issues, hitos, estado] = await Promise.all([
      gh<GhCommit[]>(`/repos/${repo}/commits?per_page=100&since=${desde}`),
      gh<GhIssue[]>(`/repos/${repo}/issues?state=all&per_page=100`),
      gh<GhMilestone[]>(`/repos/${repo}/milestones?state=open&per_page=20`),
      gh<GhEstadoCommit>(`/repos/${repo}/commits/HEAD/status`).catch(() => null),
    ]);
    const soloTareas = issues.filter((i) => !i.pull_request);
    const v = estado?.statuses.find((x) => x.context.startsWith("Vercel"));
    const despliegue: Despliegue | null = v ? { estado: v.state, fecha: v.updated_at, url: v.target_url } : null;
    return {
      ok: true,
      urlRepo: `https://github.com/${repo}`,
      commits: commits.slice(0, 8).map((c) => ({ sha: c.sha.slice(0, 7), mensaje: c.commit.message.split("\n")[0], autor: c.author?.login ?? c.commit.author.name, fecha: c.commit.author.date, url: c.html_url })),
      commitsPorSemana: porSemana(commits.map((c) => c.commit.author.date), new Date()),
      tareasAbiertas: soloTareas.filter((i) => i.state === "open").length,
      tareasCerradas: soloTareas.filter((i) => i.state === "closed").length,
      tareas: soloTareas.filter((i) => i.state === "open").slice(0, 10).map((i) => ({ numero: i.number, titulo: i.title, abierta: true, url: i.html_url, etiquetas: i.labels.map((l) => l.name), fecha: i.updated_at })),
      hitos: hitos.map((m) => ({ titulo: m.title, abiertas: m.open_issues, cerradas: m.closed_issues, vence: m.due_on, url: m.html_url })),
      despliegue,
    };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return { ok: false, motivo: m === "no-existe" ? "El repo no existe o el token no tiene acceso a él." : m === "sin-token" ? "El panel aún no tiene permiso de lectura en GitHub." : m };
  }
}
