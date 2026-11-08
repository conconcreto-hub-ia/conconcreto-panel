import "server-only";
// El pase: cómo el panel le dice a una app «esta persona entra, con este rol».
//
// Un JWT HS256 de 60 segundos, de un solo uso (jti), firmado con un secreto distinto por app
// (PASE_SECRETO_<SLUG>, el mismo valor que esa app tiene como PANEL_PASE_SECRETO). Con secretos
// separados, quien consiga el de una app no puede abrir las otras.
//
// Dos tipos:
//   entrada · el navegador lo lleva a <app>/api/pase?t=…, la app crea o actualiza a la persona y abre su sesión
//   retiro  · el panel lo manda directo (servidor a servidor) a <app>/api/pase/retirar cuando se quita el acceso:
//             la app desactiva a la persona y cierra sus sesiones al instante
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";

export const EMISOR = "conconcreto-panel";
const VIGENCIA_S = 60;

export const variableSecreto = (slug: string) => `PASE_SECRETO_${slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;

function llave(slug: string) {
  const s = process.env[variableSecreto(slug)];
  if (!s || s.length < 32) throw new Error(`Falta ${variableSecreto(slug)} (mínimo 32 caracteres): este agente todavía no está conectado al hub.`);
  return new TextEncoder().encode(s);
}

export const appConectada = (slug: string) => (process.env[variableSecreto(slug)] ?? "").length >= 32;

export type DatosPase = { tipo: "entrada" | "retiro"; correo: string; nombre: string; rol?: string };

export async function firmarPase(slug: string, d: DatosPase): Promise<string> {
  return new SignJWT({ tipo: d.tipo, nombre: d.nombre, ...(d.rol ? { rol: d.rol } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(EMISOR)
    .setAudience(slug)
    .setSubject(d.correo.toLowerCase())
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${VIGENCIA_S}s`)
    .sign(llave(slug));
}

/** Le avisa a la app que esta persona ya no entra. Devuelve el error en texto si la app no contestó bien. */
export async function avisarRetiro(app: { slug: string; url: string | null }, persona: { correo: string; nombre: string }): Promise<string | null> {
  if (!app.url) return "El agente no tiene dirección todavía: el retiro se aplica cuando esté publicado.";
  if (!appConectada(app.slug)) return "El agente no está conectado al hub.";
  try {
    const t = await firmarPase(app.slug, { tipo: "retiro", ...persona });
    const r = await fetch(new URL("/api/pase/retirar", app.url), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t }), cache: "no-store" });
    return r.ok ? null : `El agente respondió ${r.status}.`;
  } catch (e) {
    return `No se pudo hablar con el agente: ${e instanceof Error ? e.message : String(e)}`;
  }
}
