// Entrar a una app desde el panel: se revisa el acceso, se firma un pase de 60 segundos y el navegador
// lo lleva a <app>/api/pase. La app abre la sesión sin pedir clave.
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { usuarioActual } from "@/lib/auth/sesion";
import { firmarPase, appConectada } from "@/lib/pase";
import { rolesDe } from "@/lib/apps";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const volver = (motivo: string) => NextResponse.redirect(new URL(`/apps/${encodeURIComponent(slug)}?error=${encodeURIComponent(motivo)}`, req.url));

  const u = await usuarioActual();
  if (!u) return NextResponse.redirect(new URL(`/ingresar?siguiente=${encodeURIComponent(`/ir/${slug}`)}`, req.url));
  if (u.debeCambiarClave) return NextResponse.redirect(new URL("/cuenta?primera=1", req.url));

  const app = await db.app.findUnique({ where: { slug } });
  if (!app) return NextResponse.redirect(new URL("/", req.url));
  if (!app.url) return volver("Este agente todavía no está publicado.");
  if (!appConectada(app.slug)) return volver("Este agente todavía no está conectado al hub.");

  // El superadministrador entra a todos como administrador; los demás, con el rol que les dieron.
  let rol: string | undefined;
  if (u.rol === "superadmin") rol = rolesDe(app).some((r) => r.valor === "admin") ? "admin" : rolesDe(app)[0]?.valor;
  else rol = (await db.acceso.findUnique({ where: { usuarioId_appId: { usuarioId: u.id, appId: app.id } } }))?.rol;
  if (!rol) return volver("No tienes acceso a este agente. Pídeselo al administrador del hub.");

  const t = await firmarPase(app.slug, { tipo: "entrada", correo: u.correo, nombre: u.nombre, rol });
  await db.evento.create({ data: { tipo: "app.entrada", quien: u.nombre, appId: app.id, detalle: `Entró a ${app.nombre}` } });
  const destino = new URL("/api/pase", app.url);
  destino.searchParams.set("t", t);
  return NextResponse.redirect(destino);
}
