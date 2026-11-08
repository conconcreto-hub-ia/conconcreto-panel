"use server";
// Dar, cambiar y quitar el acceso de una persona a una app. Solo el administrador del panel.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigir } from "@/lib/auth/sesion";
import { avisarRetiro } from "@/lib/pase";
import { rolesDe } from "@/lib/apps";

/** rol = "" quita el acceso. Devuelve un aviso si la app no se enteró del retiro (la persona igual ya no entra desde el panel). */
export async function accionAcceso(usuarioId: string, appId: string, rol: string): Promise<{ aviso?: string }> {
  const yo = await exigir("accesos.administrar");
  const [persona, app] = await Promise.all([db.usuario.findUniqueOrThrow({ where: { id: usuarioId } }), db.app.findUniqueOrThrow({ where: { id: appId } })]);
  const previo = await db.acceso.findUnique({ where: { usuarioId_appId: { usuarioId, appId } } });

  if (!rol) {
    if (!previo) return {};
    await db.acceso.delete({ where: { id: previo.id } });
    await db.evento.create({ data: { tipo: "acceso.retirado", quien: yo.nombre, appId, detalle: `${persona.nombre} ya no entra a ${app.nombre}` } });
    const aviso = await avisarRetiro(app, persona);
    revalidatePath("/personas"); revalidatePath(`/apps/${app.slug}`);
    return aviso ? { aviso: `Quitado del panel. ${aviso}` } : {};
  }

  const r = rolesDe(app).find((x) => x.valor === rol);
  if (!r) throw new Error("Ese rol no existe en esta app.");
  await db.acceso.upsert({ where: { usuarioId_appId: { usuarioId, appId } }, update: { rol, otorgadoPor: yo.nombre }, create: { usuarioId, appId, rol, otorgadoPor: yo.nombre } });
  await db.evento.create({ data: { tipo: previo ? "acceso.cambiado" : "acceso.otorgado", quien: yo.nombre, appId, detalle: `${persona.nombre} entra a ${app.nombre} como ${r.etiqueta}` } });
  revalidatePath("/personas"); revalidatePath(`/apps/${app.slug}`);
  return {};
}

/** Cambiar el estado o la dirección de una app (lo que se ve en el panel). */
export async function accionEditarApp(appId: string, datos: { estado?: string; url?: string; repo?: string }) {
  const yo = await exigir("apps.editar");
  const estados = ["construccion", "demostracion", "piloto", "operacion"];
  if (datos.estado && !estados.includes(datos.estado)) throw new Error("Estado no válido.");
  if (datos.url && !/^https:\/\/[^\s]+$/.test(datos.url)) throw new Error("La dirección debe empezar por https://");
  if (datos.repo && !/^[\w.-]+\/[\w.-]+$/.test(datos.repo)) throw new Error("El repo va como organizacion/nombre.");
  const app = await db.app.update({ where: { id: appId }, data: { ...(datos.estado ? { estado: datos.estado as never } : {}), ...(datos.url !== undefined ? { url: datos.url || null } : {}), ...(datos.repo !== undefined ? { repo: datos.repo || null } : {}) } });
  await db.evento.create({ data: { tipo: "app.editada", quien: yo.nombre, appId, detalle: `${app.nombre}: ${Object.entries(datos).map(([k, v]) => `${k} = ${v || "(vacío)"}`).join(", ")}` } });
  revalidatePath("/"); revalidatePath(`/apps/${app.slug}`);
}
