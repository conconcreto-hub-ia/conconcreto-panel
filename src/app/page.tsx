import Link from "next/link";
import { Barra } from "@/components/barra";
import { BotonLink, Cifra, Contenedor, Encabezado, Insignia, Tarjeta, Vacio } from "@/components/ui";
import { IconoExterno, IconoFlecha } from "@/components/iconos";
import { exigirSesion } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { ESTADO, rolesDe } from "@/lib/apps";
import { avance } from "@/lib/github";
import { haceCuanto } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  const u = await exigirSesion();
  const esAdmin = u.rol === "admin";
  const [apps, accesos, personas] = await Promise.all([
    db.app.findMany({ orderBy: { orden: "asc" }, include: { _count: { select: { accesos: true } } } }),
    db.acceso.findMany({ where: { usuarioId: u.id } }),
    esAdmin ? db.usuario.count({ where: { activo: true } }) : Promise.resolve(0),
  ]);
  const avances = await Promise.all(apps.map((a) => avance(a.repo)));
  const commitsMes = avances.reduce((s, a) => s + (a.ok ? a.commitsPorSemana.slice(-4).reduce((x, y) => x + y, 0) : 0), 0);

  return (
    <>
      <Barra>
        <Contenedor className="pb-9 pt-8">
          <span className="seccion-et text-oro">Conconcreto x irrelevant · Think AI</span>
          <h1 className="mt-2 max-w-[760px] text-[30px] font-extrabold leading-tight text-white sm:text-[36px]">Las apps que estamos construyendo, en un solo lugar</h1>
          <p className="mt-3 max-w-[680px] text-[15px] text-white/70">Cada una resuelve un proceso de un área de apoyo. Desde aquí entras con tu cuenta, ves cómo va cada una y quién la lleva.</p>
          <div className="mt-7 grid max-w-[760px] grid-cols-2 gap-3 sm:grid-cols-4">
            <Cifra oscuro valor={apps.length} rotulo="apps" />
            <Cifra oscuro valor={apps.filter((a) => a.url).length} rotulo="publicadas" />
            <Cifra oscuro valor={commitsMes} rotulo="cambios en 4 semanas" />
            {esAdmin ? <Cifra oscuro valor={personas} rotulo="personas con cuenta" /> : <Cifra oscuro valor={accesos.length} rotulo="a las que entras" />}
          </div>
        </Contenedor>
      </Barra>

      <Contenedor className="space-y-5 py-10">
        <Encabezado et="Las apps" titulo="Qué hace cada una y cómo va" />
        {apps.length === 0 ? (
          <Vacio titulo="Todavía no hay apps registradas">El administrador las agrega con el script de siembra.</Vacio>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {apps.map((a, i) => {
              const av = avances[i];
              const mio = accesos.find((x) => x.appId === a.id);
              const rolEt = mio ? rolesDe(a).find((r) => r.valor === mio.rol)?.etiqueta : null;
              const puedeEntrar = !!a.url && (esAdmin || !!mio);
              const est = ESTADO[a.estado];
              return (
                <Tarjeta key={a.id} className="flex flex-col p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Insignia tono={est.tono} punto>{est.etiqueta}</Insignia>
                    {rolEt && <Insignia tono="verde">Entras como {rolEt}</Insignia>}
                    {esAdmin && <span className="text-[12px] text-tinta-3">{a._count.accesos} con acceso</span>}
                  </div>
                  <h2 className="mt-3 text-[21px] font-extrabold leading-tight">{a.nombre}</h2>
                  <p className="mt-1.5 text-[14.5px] text-tinta-2">{a.resumen}</p>
                  <p className="mt-3 text-[13px] text-tinta-3">La llevan: <span className="text-tinta-2">{a.duenos}</span></p>

                  <div className="mt-4 rounded-ctl border border-linea-2 bg-fondo px-4 py-3 text-[13px]">
                    {av.ok ? (
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <Barras valores={av.commitsPorSemana} />
                        <div className="text-right text-tinta-2">
                          <div>{av.commits[0] ? <>Último cambio {haceCuanto(av.commits[0].fecha)}</> : "Sin cambios recientes"}</div>
                          <div className="text-tinta-3">{av.tareasAbiertas} tareas abiertas · {av.tareasCerradas} cerradas</div>
                        </div>
                      </div>
                    ) : <span className="text-tinta-3">{av.motivo}</span>}
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    {puedeEntrar ? (
                      <a href={`/ir/${a.slug}`} className="inline-flex h-10 items-center gap-2 rounded-ctl bg-verde px-4 font-display text-[14px] font-semibold text-white hover:bg-verde-profundo">
                        Entrar <IconoExterno className="size-4" />
                      </a>
                    ) : (
                      <span className="inline-flex h-10 items-center rounded-ctl border border-linea px-4 text-[13px] text-tinta-3">{a.url ? "Sin acceso · pídelo al administrador" : "Aún no está publicada"}</span>
                    )}
                    <BotonLink href={`/apps/${a.slug}`}>Ver avance <IconoFlecha className="size-4" /></BotonLink>
                  </div>
                </Tarjeta>
              );
            })}
          </div>
        )}
        <p className="text-[12.5px] text-tinta-3">
          El avance sale de los repos en GitHub (se actualiza cada 5 minutos).{" "}
          {esAdmin && <Link href="/personas" className="font-semibold text-verde-profundo underline-offset-2 hover:underline">Dar acceso a alguien</Link>}
        </p>
      </Contenedor>
    </>
  );
}

/** Cambios por semana, las últimas 8. */
function Barras({ valores }: { valores: number[] }) {
  const max = Math.max(1, ...valores);
  return (
    <div>
      <div className="flex h-9 items-end gap-1" aria-label={`Cambios por semana: ${valores.join(", ")}`}>
        {valores.map((v, i) => <span key={i} className={"w-3 rounded-t-[3px] " + (v ? "bg-verde" : "bg-linea")} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />)}
      </div>
      <div className="mt-1 text-[11.5px] text-tinta-3">Cambios por semana · 8 semanas</div>
    </div>
  );
}
