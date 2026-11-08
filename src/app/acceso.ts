"use server";
// Ingresar, salir, cambiar la clave y administrar usuarios.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ingresar, salir, exigir, usuarioActual } from "@/lib/auth/sesion";
import { cifrarClave, claveCorrecta, claveTemporal, problemaDeClave } from "@/lib/auth/clave";
import type { Rol } from "@prisma/client";
import { destinoSeguro } from "@/lib/auth/destino";
import { avisarRetiro } from "@/lib/pase";


export async function accionIngresar(_: unknown, f: FormData): Promise<{ error: string } | undefined> {
  const r = await ingresar(String(f.get("correo") ?? ""), String(f.get("clave") ?? ""));
  if (!r.ok) return { error: r.error };
  redirect(r.debeCambiarClave ? "/cuenta?primera=1" : destinoSeguro(String(f.get("siguiente") ?? "")));
}

export async function accionSalir() {
  await salir();
  redirect("/ingresar");
}

export async function accionCambiarClave(_: unknown, f: FormData): Promise<{ error?: string; ok?: boolean }> {
  const u = await usuarioActual();
  if (!u) redirect("/ingresar");
  const actual = String(f.get("actual") ?? ""), nueva = String(f.get("nueva") ?? ""), repetida = String(f.get("repetida") ?? "");
  const guardado = await db.usuario.findUniqueOrThrow({ where: { id: u.id } });
  if (!(await claveCorrecta(actual, guardado.hash))) return { error: "La clave actual no es correcta." };
  const problema = problemaDeClave(nueva);
  if (problema) return { error: problema };
  if (nueva !== repetida) return { error: "Las dos claves nuevas no coinciden." };
  if (nueva === actual) return { error: "La clave nueva tiene que ser distinta de la actual." };
  await db.usuario.update({ where: { id: u.id }, data: { hash: await cifrarClave(nueva), debeCambiarClave: false } });
  if (u.debeCambiarClave) redirect("/");
  return { ok: true };
}

/* ── Usuarios (solo administrador) ─────────────────────────────────── */

const ROLES: Rol[] = ["admin", "miembro"];

export async function accionCrearUsuario(_: unknown, f: FormData): Promise<{ error?: string; creado?: { correo: string; clave: string } }> {
  await exigir("usuarios.administrar");
  const nombre = String(f.get("nombre") ?? "").trim();
  const correo = String(f.get("correo") ?? "").trim().toLowerCase();
  const rol = String(f.get("rol") ?? "") as Rol;
  const cargo = String(f.get("cargo") ?? "").trim() || null;
  if (!nombre) return { error: "Falta el nombre." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { error: "El correo no es válido." };
  if (!ROLES.includes(rol)) return { error: "Rol no válido." };
  if (await db.usuario.findUnique({ where: { correo } })) return { error: "Ya hay un usuario con ese correo." };
  const clave = claveTemporal();
  await db.usuario.create({ data: { nombre, correo, cargo, rol, hash: await cifrarClave(clave), debeCambiarClave: true } });
  revalidatePath("/personas");
  return { creado: { correo, clave } };
}

export async function accionCambiarRol(id: string, rol: Rol) {
  const yo = await exigir("usuarios.administrar");
  if (!ROLES.includes(rol)) throw new Error("Rol no válido.");
  if (id === yo.id && rol !== "admin") throw new Error("No puedes quitarte el rol de administrador a ti mismo.");
  await db.usuario.update({ where: { id }, data: { rol } });
  revalidatePath("/personas");
}

export async function accionActivar(id: string, activo: boolean) {
  const yo = await exigir("usuarios.administrar");
  if (id === yo.id && !activo) throw new Error("No puedes desactivarte a ti mismo.");
  await db.$transaction([
    db.usuario.update({ where: { id }, data: { activo } }),
    // Desactivar cierra sus sesiones de inmediato.
    ...(activo ? [] : [db.sesion.deleteMany({ where: { usuarioId: id } })]),
  ]);
  // Y en cada app a la que entraba: queda desactivada allá también, con sus sesiones cerradas.
  if (!activo) {
    const p = await db.usuario.findUniqueOrThrow({ where: { id }, include: { accesos: { include: { app: true } } } });
    await Promise.all(p.accesos.map((a) => avisarRetiro(a.app, p)));
    await db.evento.create({ data: { tipo: "usuario.desactivado", quien: yo.nombre, detalle: `${p.nombre} desactivado en el panel y en ${p.accesos.length} app(s)` } });
  }
  revalidatePath("/personas");
}

export async function accionNuevaClave(id: string): Promise<{ clave: string }> {
  await exigir("usuarios.administrar");
  const clave = claveTemporal();
  await db.$transaction([
    db.usuario.update({ where: { id }, data: { hash: await cifrarClave(clave), debeCambiarClave: true } }),
    db.sesion.deleteMany({ where: { usuarioId: id } }),
  ]);
  revalidatePath("/personas");
  return { clave };
}
