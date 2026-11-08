import "server-only";
// ¿Está arriba cada agente? Una petición a su página de ingreso, con 4 segundos de paciencia, al cargar el
// centro de mando (no de fondo). La página de ingreso de cada app no toca su base: Neon puede dormir.

export type Salud = { estado: "en-linea" | "caido" | "sin-publicar"; ms: number | null; codigo: number | null };

export async function salud(url: string | null): Promise<Salud> {
  if (!url) return { estado: "sin-publicar", ms: null, codigo: null };
  const t0 = Date.now();
  try {
    const r = await fetch(new URL("/ingresar", url), { method: "GET", redirect: "manual", signal: AbortSignal.timeout(4000), cache: "no-store" });
    const ms = Date.now() - t0;
    return { estado: r.status < 500 ? "en-linea" : "caido", ms, codigo: r.status };
  } catch {
    return { estado: "caido", ms: null, codigo: null };
  }
}
