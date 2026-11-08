import "server-only";
// Dar y quitar acceso al código: la persona queda (o deja de estar) como colaboradora del repo del agente.
//
// GITHUB_ADMIN_TOKEN: un token fine-grained de la organización con Administration (lectura y escritura) en
// los repos de los agentes. Es distinto del de lectura del avance (GITHUB_TOKEN) a propósito: el que se usa
// en cada carga del centro de mando no puede cambiar nada.
const API = "https://api.github.com";

export const githubAdminListo = () => !!process.env.GITHUB_ADMIN_TOKEN;

async function gh(metodo: string, ruta: string, cuerpo?: unknown) {
  const token = process.env.GITHUB_ADMIN_TOKEN;
  if (!token) throw new Error("El hub todavía no tiene permiso para administrar el código en GitHub (falta GITHUB_ADMIN_TOKEN).");
  return fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(cuerpo ? { "content-type": "application/json" } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    cache: "no-store",
  });
}

/** Un usuario de GitHub válido: letras, números y guiones, sin empezar ni terminar en guion. */
export const usuarioValido = (u: string) => /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(u);

/** ¿Existe ese usuario en GitHub? Con el token de lectura basta. */
export async function existeUsuario(usuario: string): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_ADMIN_TOKEN;
  const r = await fetch(`${API}/users/${encodeURIComponent(usuario)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
  return r.ok;
}

/** Lo deja como colaborador con ese nivel. Devuelve qué pasó, en palabras. */
export async function darCodigo(repo: string, usuario: string, nivel: "lectura" | "escritura"): Promise<string> {
  const r = await gh("PUT", `/repos/${repo}/collaborators/${encodeURIComponent(usuario)}`, { permission: nivel === "escritura" ? "push" : "pull" });
  if (r.status === 201) return `Invitación enviada a @${usuario} (${nivel === "escritura" ? "puede editar" : "solo ver"}). La acepta desde su correo o GitHub.`;
  if (r.status === 204) return `@${usuario} ya era colaborador: nivel actualizado a ${nivel === "escritura" ? "editar" : "ver"}.`;
  const cuerpo = await r.json().catch(() => ({}));
  throw new Error(`GitHub respondió ${r.status}${cuerpo?.message ? `: ${cuerpo.message}` : ""}.`);
}

/** Lo saca del repo: como colaborador y, si la invitación seguía pendiente, la cancela. */
export async function quitarCodigo(repo: string, usuario: string): Promise<string> {
  const r = await gh("DELETE", `/repos/${repo}/collaborators/${encodeURIComponent(usuario)}`);
  if (![204, 404].includes(r.status)) throw new Error(`GitHub respondió ${r.status} al quitar a @${usuario}.`);
  const inv = await gh("GET", `/repos/${repo}/invitations?per_page=100`);
  if (inv.ok) {
    const lista = (await inv.json()) as { id: number; invitee: { login: string } | null }[];
    for (const i of lista.filter((x) => x.invitee?.login.toLowerCase() === usuario.toLowerCase())) await gh("DELETE", `/repos/${repo}/invitations/${i.id}`);
  }
  return `@${usuario} ya no tiene acceso al código.`;
}
