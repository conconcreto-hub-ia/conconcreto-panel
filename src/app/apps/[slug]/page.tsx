import { notFound } from "next/navigation";
import { Barra } from "@/components/barra";
import { Contenedor, Dato, Encabezado, Insignia, Tarjeta } from "@/components/ui";
import { IconoExterno } from "@/components/iconos";
import { exigirSesion } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { ESTADO, rolesDe } from "@/lib/apps";
import { avance } from "@/lib/github";
import { appConectada } from "@/lib/pase";
import { fecha, haceCuanto } from "@/lib/formato";
import { EditorApp } from "./editor";

export const dynamic = "force-dynamic";

export default async function FichaApp({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const u = await exigirSesion();
  const { slug } = await params;
  const { error } = await searchParams;
  const app = await db.app.findUnique({ where: { slug }, include: { accesos: { include: { usuario: true }, orderBy: { createdAt: "asc" } } } });
  if (!app) notFound();
  const esAdmin = u.rol === "admin";
  const av = await avance(app.repo);
  const roles = rolesDe(app);
  const mio = app.accesos.find((a) => a.usuarioId === u.id);
  const puedeEntrar = !!app.url && (esAdmin || !!mio);

  return (
    <>
      <Barra />
      <Contenedor className="space-y-6 py-10">
        <a href="/" className="rotulo hover:text-white">← Centro de mando</a>
        <Encabezado
          et={ESTADO[app.estado].etiqueta}
          titulo={app.nombre}
          bajada={app.resumen}
          acciones={puedeEntrar ? <a href={`/ir/${app.slug}`} className="inline-flex h-10 items-center gap-2 rounded-ctl px-4 font-display text-[14px] font-bold text-[#1a1300] [background:var(--degradado)] hover:brightness-110">Entrar <IconoExterno className="size-4" /></a> : undefined}
        />
        {error && <p role="alert" className="rounded-ctl border border-rojo/30 bg-rojo-suave px-4 py-3 text-[14px] text-rojo">{error}</p>}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 space-y-6">
            <Tarjeta className="p-6">
              <span className="seccion-et">El problema</span>
              <p className="mt-2 text-[15px] leading-relaxed text-tinta-2">{app.problema}</p>
            </Tarjeta>

            <Tarjeta className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="seccion-et">El avance</span>
                {av.ok && <a href={av.urlRepo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-verde-profundo hover:underline">Ver el repo en GitHub <IconoExterno className="size-3.5" /></a>}
              </div>
              {!av.ok ? <p className="mt-2 text-[14px] text-tinta-3">{av.motivo}</p> : (
                <div className="mt-4 space-y-6">
                  <div className="grid grid-cols-3 gap-3">
                    <Dato k="Cambios en 8 semanas">{av.commitsPorSemana.reduce((a, b) => a + b, 0)}</Dato>
                    <Dato k="Tareas abiertas">{av.tareasAbiertas}</Dato>
                    <Dato k="Tareas cerradas">{av.tareasCerradas}</Dato>
                  </div>

                  {av.hitos.length > 0 && (
                    <div>
                      <h3 className="text-[14px] font-bold">Hitos</h3>
                      <ul className="mt-2 space-y-2.5 pl-0">
                        {av.hitos.map((h) => {
                          const total = h.abiertas + h.cerradas, pct = total ? Math.round((h.cerradas / total) * 100) : 0;
                          return (
                            <li key={h.titulo} className="list-none">
                              <div className="flex justify-between text-[13.5px]"><a href={h.url} target="_blank" rel="noreferrer" className="font-semibold hover:underline">{h.titulo}</a><span className="text-tinta-3">{h.cerradas} de {total}{h.vence ? ` · vence ${fecha(h.vence)}` : ""}</span></div>
                              <div className="mt-1 h-1.5 rounded-full bg-linea-2"><div className="h-1.5 rounded-full bg-verde" style={{ width: `${pct}%` }} /></div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h3 className="text-[14px] font-bold">Lo último que cambió</h3>
                    {av.commits.length === 0 ? <p className="mt-1 text-[13.5px] text-tinta-3">Sin cambios en las últimas 8 semanas.</p> : (
                      <ul className="mt-2 divide-y divide-linea-2 pl-0">
                        {av.commits.map((c) => (
                          <li key={c.sha} className="flex list-none items-baseline justify-between gap-3 py-2 text-[13.5px]">
                            <a href={c.url} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:underline">{c.mensaje}</a>
                            <span className="shrink-0 text-[12px] text-tinta-3">{c.autor} · {haceCuanto(c.fecha)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {av.tareas.length > 0 && (
                    <div>
                      <h3 className="text-[14px] font-bold">Lo que falta</h3>
                      <ul className="mt-2 space-y-1.5 pl-0">
                        {av.tareas.map((t) => (
                          <li key={t.numero} className="flex list-none flex-wrap items-center gap-2 text-[13.5px]">
                            <a href={t.url} target="_blank" rel="noreferrer" className="hover:underline">#{t.numero} {t.titulo}</a>
                            {t.etiquetas.map((e) => <Insignia key={e}>{e}</Insignia>)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Tarjeta>
          </section>

          <aside className="space-y-4">
            <Tarjeta className="space-y-3 p-5 text-[14px]">
              <Dato k="La llevan">{app.duenos}</Dato>
              <Dato k="Dirección">{app.url ? <a href={app.url} className="break-all text-verde-profundo hover:underline">{app.url.replace(/^https:\/\//, "")}</a> : "Aún no está publicado"}</Dato>
              {esAdmin && <Dato k="Conexión con el hub">{appConectada(app.slug) ? "Conectada" : "Falta el secreto del pase"}</Dato>}
              {av.ok && av.despliegue && <Dato k="Última publicación">{av.despliegue.estado === "success" ? "Publicada" : av.despliegue.estado} · {haceCuanto(av.despliegue.fecha)}</Dato>}
            </Tarjeta>

            <Tarjeta className="p-5">
              <h3 className="text-[15px] font-bold">Los roles dentro del agente</h3>
              <ul className="mt-2 space-y-2 pl-0">
                {roles.map((r) => <li key={r.valor} className="list-none text-[13.5px]"><b className="font-display font-semibold">{r.etiqueta}</b> <span className="text-tinta-2">· {r.detalle}</span></li>)}
              </ul>
            </Tarjeta>

            {esAdmin && (
              <Tarjeta className="p-5">
                <h3 className="text-[15px] font-bold">Quién entra</h3>
                {app.accesos.length === 0 ? <p className="mt-1 text-[13.5px] text-tinta-3">Nadie todavía, salvo los administradores del hub.</p> : (
                  <ul className="mt-2 space-y-1.5 pl-0">
                    {app.accesos.map((a) => <li key={a.id} className="list-none text-[13.5px]"><span className="font-semibold">{a.usuario.nombre}</span> <span className="text-tinta-3">· {roles.find((r) => r.valor === a.rol)?.etiqueta ?? a.rol}</span></li>)}
                  </ul>
                )}
                <a href="/personas" className="mt-3 inline-block text-[13px] font-semibold text-verde-profundo hover:underline">Cambiar los accesos</a>
              </Tarjeta>
            )}

            {esAdmin && <EditorApp id={app.id} estado={app.estado} url={app.url ?? ""} repo={app.repo ?? ""} />}
          </aside>
        </div>
      </Contenedor>
    </>
  );
}
