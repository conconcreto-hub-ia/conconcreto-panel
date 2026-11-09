"use server";
// El acceso al código de cada agente en GitHub. El acceso a cada agente lo maneja el agente mismo: cada uno
// es independiente, con su propio inicio de sesión.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigir } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/permisos";
import { darCodigo, quitarCodigo } from "@/lib/github-admin";

async function preparar(usuarioId: string, appId: string) {
  const yo = await exigir("accesos.administrar");
  const [persona, app] = await Promise.all([db.usuario.findUniqueOrThrow({ where: { id: usuarioId } }), db.app.findUniqueOrThrow({ where: { id: appId } })]);
  if (persona.rol === "superadmin" && !puede(yo.rol, "roles.privilegiados")) throw new Error("Solo un superadministrador puede cambiar a otro superadministrador.");
  const previo = await db.acceso.findUnique({ where: { usuarioId_appId: { usuarioId, appId } } });
  return { yo, persona, app, previo };
}

const revalidar = (slug: string) => { revalidatePath("/personas"); revalidatePath(`/apps/${slug}`); revalidatePath("/"); };

/** El acceso al código del agente: ninguno, ver o editar. Exige que la persona tenga usuario de GitHub. */
export async function accionCodigo(usuarioId: string, appId: string, nivel: "ninguno" | "lectura" | "escritura"): Promise<{ nota: string }> {
  await exigir("github.administrar");
  const { yo, persona, app, previo } = await preparar(usuarioId, appId);
  if (!["ninguno", "lectura", "escritura"].includes(nivel)) throw new Error("Nivel no válido.");
  if (!app.repo) throw new Error("Este agente todavía no tiene repo en GitHub.");
  if (!persona.github) throw new Error("Primero pon el usuario de GitHub de esta persona.");
  const nota = nivel === "ninguno" ? await quitarCodigo(app.repo, persona.github) : await darCodigo(app.repo, persona.github, nivel);
  await db.acceso.upsert({
    where: { usuarioId_appId: { usuarioId, appId } },
    update: { codigo: nivel, codigoNota: nota },
    create: { usuarioId, appId, rol: "", codigo: nivel, codigoNota: nota, otorgadoPor: yo.nombre },
  });
  await db.evento.create({ data: { tipo: "codigo", quien: yo.nombre, appId, detalle: `${persona.nombre} · código de ${app.nombre}: ${nivel === "ninguno" ? "sin acceso" : nivel === "lectura" ? "ver" : "editar"}` } });
  revalidar(app.slug);
  return { nota };
}

/** Cambiar el estado o la dirección de un agente (lo que se ve en el hub). */
export async function accionEditarApp(appId: string, datos: { estado?: string; url?: string; repo?: string }) {
  const yo = await exigir("apps.editar");
  const estados = ["construccion", "demostracion", "piloto", "operacion"];
  if (datos.estado && !estados.includes(datos.estado)) throw new Error("Estado no válido.");
  if (datos.url && !/^https:\/\/[^\s]+$/.test(datos.url)) throw new Error("La dirección debe empezar por https://");
  if (datos.repo && !/^[\w.-]+\/[\w.-]+$/.test(datos.repo)) throw new Error("El repo va como organizacion/nombre.");
  const app = await db.app.update({ where: { id: appId }, data: { ...(datos.estado ? { estado: datos.estado as never } : {}), ...(datos.url !== undefined ? { url: datos.url || null } : {}), ...(datos.repo !== undefined ? { repo: datos.repo || null } : {}) } });
  await db.evento.create({ data: { tipo: "app.editada", quien: yo.nombre, appId, detalle: `${app.nombre}: ${Object.entries(datos).map(([k, v]) => `${k} = ${v || "(vacío)"}`).join(", ")}` } });
  revalidar(app.slug);
}
