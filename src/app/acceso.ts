"use server";
// Ingresar, salir, cambiar la clave y administrar usuarios.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ingresar, salir, exigir, usuarioActual } from "@/lib/auth/sesion";
import { cifrarClave, claveCorrecta, claveTemporal, problemaDeClave } from "@/lib/auth/clave";
import type { Rol } from "@prisma/client";
import { destinoSeguro } from "@/lib/auth/destino";
import { puede, ROL } from "@/lib/auth/permisos";
import { existeUsuario, quitarCodigo, usuarioValido } from "@/lib/github-admin";


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

/* ── Personas (superadministrador y administrador) ─────────────────── */
//
// Reglas: un administrador agrega miembros y maneja a los que no son superadministradores. Solo un
// superadministrador nombra administradores o superadministradores, o toca a otro superadministrador.
// Nadie se quita su propio rol ni se desactiva a sí mismo. Siempre queda al menos un superadministrador.

const ROLES: Rol[] = ["superadmin", "admin", "miembro"];
const PRIVILEGIADOS: Rol[] = ["superadmin", "admin"];

async function exigirSobre(id: string) {
  const yo = await exigir("usuarios.administrar");
  const otro = await db.usuario.findUniqueOrThrow({ where: { id } });
  if (otro.rol === "superadmin" && !puede(yo.rol, "roles.privilegiados")) throw new Error("Solo un superadministrador puede cambiar a otro superadministrador.");
  return { yo, otro };
}

export async function accionCrearUsuario(_: unknown, f: FormData): Promise<{ error?: string; creado?: { correo: string; clave: string } }> {
  const yo = await exigir("usuarios.administrar");
  const nombre = String(f.get("nombre") ?? "").trim();
  const correo = String(f.get("correo") ?? "").trim().toLowerCase();
  const rol = String(f.get("rol") ?? "") as Rol;
  const cargo = String(f.get("cargo") ?? "").trim() || null;
  const github = String(f.get("github") ?? "").trim().replace(/^@/, "") || null;
  if (!nombre) return { error: "Falta el nombre." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { error: "El correo no es válido." };
  if (!ROLES.includes(rol)) return { error: "Rol no válido." };
  if (PRIVILEGIADOS.includes(rol) && !puede(yo.rol, "roles.privilegiados")) return { error: "Solo un superadministrador puede crear administradores." };
  if (github && !usuarioValido(github)) return { error: "El usuario de GitHub no es válido." };
  if (github && !(await existeUsuario(github))) return { error: `No existe el usuario @${github} en GitHub.` };
  if (await db.usuario.findUnique({ where: { correo } })) return { error: "Ya hay un usuario con ese correo." };
  const clave = claveTemporal();
  await db.usuario.create({ data: { nombre, correo, cargo, github, rol, hash: await cifrarClave(clave), debeCambiarClave: true } });
  await db.evento.create({ data: { tipo: "usuario.creado", quien: yo.nombre, detalle: `${nombre} (${correo}) como ${ROL[rol].etiqueta}` } });
  revalidatePath("/personas");
  return { creado: { correo, clave } };
}

export async function accionCambiarRol(id: string, rol: Rol) {
  const { yo, otro } = await exigirSobre(id);
  if (!ROLES.includes(rol)) throw new Error("Rol no válido.");
  if (id === yo.id) throw new Error("No puedes cambiar tu propio rol.");
  if ((PRIVILEGIADOS.includes(rol) || PRIVILEGIADOS.includes(otro.rol)) && !puede(yo.rol, "roles.privilegiados")) throw new Error("Solo un superadministrador nombra o retira administradores.");
  if (otro.rol === "superadmin" && rol !== "superadmin" && (await db.usuario.count({ where: { rol: "superadmin", activo: true } })) <= 1) throw new Error("Tiene que quedar al menos un superadministrador.");
  await db.usuario.update({ where: { id }, data: { rol } });
  await db.evento.create({ data: { tipo: "usuario.rol", quien: yo.nombre, detalle: `${otro.nombre} pasa a ${ROL[rol].etiqueta}` } });
  revalidatePath("/personas");
}

/** El usuario de GitHub de una persona. Vacío lo borra (y le quita el acceso al código que tuviera). */
export async function accionGithub(id: string, valor: string): Promise<{ aviso?: string }> {
  const { yo, otro } = await exigirSobre(id);
  const github = valor.trim().replace(/^@/, "") || null;
  if (github && !usuarioValido(github)) throw new Error("El usuario de GitHub no es válido.");
  if (github && !(await existeUsuario(github))) throw new Error(`No existe el usuario @${github} en GitHub.`);
  if ((github ?? "") === (otro.github ?? "")) return {};
  // Si cambia de usuario, el anterior sale de los repos; el acceso al código queda en «ninguno» para volver a darlo.
  const avisos: string[] = [];
  if (otro.github) {
    const conCodigo = await db.acceso.findMany({ where: { usuarioId: id, codigo: { not: "ninguno" } }, include: { app: true } });
    for (const a of conCodigo) {
      if (a.app.repo) await quitarCodigo(a.app.repo, otro.github).catch((e) => avisos.push(e instanceof Error ? e.message : String(e)));
      await db.acceso.update({ where: { id: a.id }, data: { codigo: "ninguno", codigoNota: null } });
    }
  }
  await db.usuario.update({ where: { id }, data: { github } });
  await db.evento.create({ data: { tipo: "usuario.github", quien: yo.nombre, detalle: `${otro.nombre}: GitHub ${github ? `@${github}` : "(sin usuario)"}` } });
  revalidatePath("/personas");
  return avisos.length ? { aviso: avisos.join(" ") } : {};
}

export async function accionActivar(id: string, activo: boolean) {
  const { yo, otro } = await exigirSobre(id);
  if (id === yo.id && !activo) throw new Error("No puedes desactivarte a ti mismo.");
  if (!activo && otro.rol === "superadmin" && (await db.usuario.count({ where: { rol: "superadmin", activo: true } })) <= 1) throw new Error("Tiene que quedar al menos un superadministrador.");
  await db.$transaction([
    db.usuario.update({ where: { id }, data: { activo } }),
    // Desactivar cierra sus sesiones de inmediato.
    ...(activo ? [] : [db.sesion.deleteMany({ where: { usuarioId: id } })]),
  ]);
  if (!activo) {
    // Sale de los repos a los que tenía acceso al código. Su usuario dentro de cada agente lo maneja el agente.
    if (otro.github) {
      const conCodigo = await db.acceso.findMany({ where: { usuarioId: id, codigo: { not: "ninguno" } }, include: { app: true } });
      for (const a of conCodigo) if (a.app.repo) await quitarCodigo(a.app.repo, otro.github).catch(() => null);
      await db.acceso.updateMany({ where: { usuarioId: id }, data: { codigo: "ninguno", codigoNota: null } });
    }
    await db.evento.create({ data: { tipo: "usuario.desactivado", quien: yo.nombre, detalle: `${otro.nombre} desactivado en el hub y retirado de GitHub` } });
  }
  revalidatePath("/personas");
}

export async function accionNuevaClave(id: string): Promise<{ clave: string }> {
  await exigirSobre(id);
  const clave = claveTemporal();
  await db.$transaction([
    db.usuario.update({ where: { id }, data: { hash: await cifrarClave(clave), debeCambiarClave: true } }),
    db.sesion.deleteMany({ where: { usuarioId: id } }),
  ]);
  revalidatePath("/personas");
  return { clave };
}
