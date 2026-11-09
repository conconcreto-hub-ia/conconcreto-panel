import Link from "next/link";
import { Barra } from "@/components/barra";
import { Contenedor, Insignia } from "@/components/ui";
import { IconoExterno, IconoFlecha } from "@/components/iconos";
import { exigirSesion } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { ESTADO } from "@/lib/apps";
import { avance, type Avance } from "@/lib/github";
import { salud, type Salud } from "@/lib/salud";
import { haceCuanto } from "@/lib/formato";
import { administra } from "@/lib/auth/permisos";

export const dynamic = "force-dynamic";

const codigo = (orden: number) => `AG-${String(orden).padStart(2, "0")}`;

export default async function CentroDeMando() {
  const u = await exigirSesion();
  const esAdmin = administra(u.rol);
  const [apps, personas, conCodigo, eventos] = await Promise.all([
    db.app.findMany({ orderBy: { orden: "asc" }, include: { _count: { select: { accesos: { where: { codigo: { not: "ninguno" } } } } } } }),
    db.usuario.count({ where: { activo: true } }),
    db.usuario.count({ where: { activo: true, github: { not: null }, accesos: { some: { codigo: { not: "ninguno" } } } } }),
    esAdmin ? db.evento.findMany({ orderBy: { createdAt: "desc" }, take: 12 }) : Promise.resolve([]),
  ]);
  // Todos ven todos los agentes: cada uno tiene su propio inicio de sesión, que maneja su equipo.
  const visibles = apps;
  const [avances, saludes] = await Promise.all([Promise.all(visibles.map((a) => avance(a.repo))), Promise.all(visibles.map((a) => salud(a.url)))]);

  const publicados = saludes.filter((s) => s.estado !== "sin-publicar").length;
  const enLinea = saludes.filter((s) => s.estado === "en-linea").length;
  const latencias = saludes.map((s) => s.ms).filter((m): m is number => m !== null);
  const latencia = latencias.length ? Math.round(latencias.reduce((a, b) => a + b, 0) / latencias.length) : null;
  const ok = avances.filter((a): a is Extract<Avance, { ok: true }> => a.ok);
  const cambios4 = ok.reduce((s, a) => s + a.commitsPorSemana.slice(-4).reduce((x, y) => x + y, 0), 0);
  const tareas = ok.reduce((s, a) => s + a.tareasAbiertas, 0);
  const todoBien = publicados > 0 && enLinea === publicados;

  // Actividad: lo que hicieron las personas en el hub y lo que cambió en el código, juntos y en orden.
  const actividad = [
    ...eventos.map((e) => ({ id: e.id, fecha: e.createdAt.toISOString(), tipo: e.tipo.startsWith("app.entrada") ? "entrada" : "acceso", texto: `${e.quien} · ${e.detalle}` })),
    ...visibles.flatMap((a, i) => { const av = avances[i]; return av.ok ? av.commits.slice(0, 4).map((c) => ({ id: `${a.slug}-${c.sha}`, fecha: c.fecha, tipo: "codigo", texto: `${a.nombre} · ${c.mensaje}` })) : []; }),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 14);

  return (
    <div className="grilla min-h-screen">
      <Barra />
      <Contenedor className="space-y-7 py-8">
        {/* Cabecera */}
        <section className="escaneo flex flex-wrap items-end justify-between gap-6 rounded-sup border border-linea bg-white/[.02] px-6 py-6">
          <div>
            <div className="rotulo">Conconcreto · Hub de IA · Áreas de apoyo</div>
            <h1 className="mt-2 text-[34px] font-extrabold leading-none text-white sm:text-[42px]">Centro de mando</h1>
            <p className="mt-3 max-w-[620px] text-[15px] text-tinta-2">Los agentes de IA que trabajan para las áreas de apoyo: si están arriba, qué ha cambiado y quién los opera.</p>
          </div>
          <div className="min-w-[230px] rounded-ctl border border-linea bg-black/30 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className={"led " + (todoBien ? "led-ok" : publicados ? "led-mal" : "led-off")} />
              <span className="font-mono text-[13px] font-medium uppercase tracking-[.1em] text-white">{todoBien ? "Operación normal" : publicados ? "Revisar" : "Sin agentes publicados"}</span>
            </div>
            <div className="mt-1.5 font-mono text-[12px] text-tinta-3">{enLinea}/{visibles.length} agentes en línea · revisado ahora</div>
          </div>
        </section>

        {/* Indicadores */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Indicador rotulo="Agentes en línea" valor={`${enLinea}`} unidad={`/${visibles.length}`} tono={todoBien ? "verde" : "neutro"} />
          <Indicador rotulo="Latencia media" valor={latencia === null ? "—" : `${latencia}`} unidad={latencia === null ? "" : "ms"} />
          <Indicador rotulo="Cambios · 4 sem" valor={`${cambios4}`} nota="en el código" />
          <Indicador rotulo="Tareas abiertas" valor={`${tareas}`} nota="en GitHub" />
          <Indicador rotulo="Con el código" valor={`${conCodigo}`} nota="personas en GitHub" />
          <Indicador rotulo="Personas" valor={`${personas}`} nota="con cuenta en el hub" />
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Los agentes */}
          <section className="min-w-0">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="rotulo text-white/70">Agentes</h2>
              {esAdmin && <Link href="/personas" className="font-mono text-[11.5px] uppercase tracking-[.12em] text-verde-profundo hover:underline">Dar acceso →</Link>}
            </div>
            {visibles.length === 0 ? (
              <div className="modulo px-6 py-12 text-center">
                <div className="rotulo">Sin agentes asignados</div>
                <p className="mt-2 text-[14px] text-tinta-2">Todavía no tienes acceso a ningún agente. Pídeselo al administrador del hub.</p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {visibles.map((a, i) => (
                  <ModuloAgente
                    key={a.id}
                    app={a}
                    av={avances[i]}
                    sal={saludes[i]}
                    personas={a._count.accesos}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Actividad */}
          <aside className="space-y-4">
            <div className="modulo p-5">
              <div className="flex items-center justify-between">
                <h2 className="rotulo text-white/70">Actividad</h2>
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-tinta-3"><span className="led led-ok !size-1.5" />en vivo</span>
              </div>
              {actividad.length === 0 ? (
                <p className="mt-4 text-[13.5px] text-tinta-3">Aún no hay movimiento. Aparecerá aquí cuando alguien entre a un agente o cambie su código.</p>
              ) : (
                <ol className="mt-4 space-y-0 pl-0">
                  {actividad.map((x) => (
                    <li key={x.id} className="relative list-none border-l border-linea pb-3.5 pl-4 last:pb-0">
                      <span className={"absolute -left-[4.5px] top-1.5 size-2 rounded-full " + (x.tipo === "codigo" ? "bg-oro" : x.tipo === "entrada" ? "bg-[#4ade80]" : "bg-white/40")} />
                      <div className="font-mono text-[10.5px] uppercase tracking-[.1em] text-tinta-3">{x.tipo === "codigo" ? "Código" : x.tipo === "entrada" ? "Entrada" : "Acceso"} · {haceCuanto(x.fecha)}</div>
                      <div className="mt-0.5 text-[13px] leading-snug text-tinta-2">{x.texto}</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="modulo p-5">
              <h2 className="rotulo text-white/70">Cómo funciona</h2>
              <ul className="mt-3 space-y-2.5 pl-0 text-[13px] text-tinta-2">
                <li className="list-none"><span className="font-mono text-oro">01</span> El hub muestra cómo va cada agente y quién toca su código.</li>
                <li className="list-none"><span className="font-mono text-oro">02</span> Cada agente tiene su propio inicio de sesión: lo administra su equipo.</li>
                <li className="list-none"><span className="font-mono text-oro">03</span> Cada agente propone; una persona aprueba lo que sale.</li>
              </ul>
            </div>
          </aside>
        </div>
      </Contenedor>
    </div>
  );
}

function Indicador({ rotulo, valor, unidad, nota, tono = "neutro" }: { rotulo: string; valor: string; unidad?: string; nota?: string; tono?: "verde" | "neutro" }) {
  return (
    <div className="modulo px-4 py-3.5">
      <div className="rotulo !text-[10.5px]">{rotulo}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={"font-mono text-[28px] font-medium leading-none tabular " + (tono === "verde" ? "text-[#4ade80]" : "text-white")}>{valor}</span>
        {unidad && <span className="font-mono text-[13px] text-tinta-3">{unidad}</span>}
      </div>
      {nota && <div className="mt-1 text-[11.5px] text-tinta-3">{nota}</div>}
    </div>
  );
}

type AppFila = { id: string; slug: string; nombre: string; resumen: string; duenos: string; orden: number; estado: keyof typeof ESTADO; url: string | null };

function ModuloAgente({ app, av, sal, personas }: { app: AppFila; av: Avance; sal: Salud; personas: number }) {
  const est = ESTADO[app.estado];
  const puedeEntrar = !!app.url;
  const led = sal.estado === "en-linea" ? "led-ok" : sal.estado === "caido" ? "led-mal" : "led-off";
  const textoSalud = sal.estado === "en-linea" ? `En línea${sal.ms !== null ? ` · ${sal.ms} ms` : ""}` : sal.estado === "caido" ? "Sin respuesta" : "Sin publicar";
  return (
    <article className="modulo flex flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[12px] font-medium tracking-[.12em] text-oro">{codigo(app.orden)}</span>
        <span className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-[.08em] text-tinta-2"><span className={"led " + led} />{textoSalud}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h3 className="text-[20px] font-extrabold leading-tight text-white">{app.nombre}</h3>
        <Insignia tono={est.tono}>{est.etiqueta}</Insignia>
      </div>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-tinta-2">{app.resumen}</p>

      <div className="mt-4 rounded-ctl border border-linea-2 bg-black/25 px-3.5 pb-2 pt-3">
        <div className="flex items-center justify-between">
          <span className="rotulo !text-[10px]">Actividad del código · 8 semanas</span>
          {av.ok && <span className="font-mono text-[11px] text-tinta-3">{av.commitsPorSemana.reduce((a, b) => a + b, 0)} cambios</span>}
        </div>
        {av.ok ? <Curva valores={av.commitsPorSemana} /> : <p className="py-3 text-[12px] text-tinta-3">{av.motivo}</p>}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Metrica k="Último cambio" v={av.ok && av.commits[0] ? haceCuanto(av.commits[0].fecha) : "—"} />
        <Metrica k="Tareas" v={av.ok ? `${av.tareasAbiertas} abiertas` : "—"} />
        <Metrica k="Con el código" v={`${personas}`} />
      </dl>

      <p className="mt-3 font-mono text-[11px] uppercase tracking-[.08em] text-tinta-3">Lo llevan · <span className="normal-case tracking-normal text-tinta-2">{app.duenos}</span></p>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {puedeEntrar ? (
          <a href={app.url!} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-ctl px-4 font-display text-[13.5px] font-bold text-[#1a1300] [background:var(--degradado)] hover:brightness-110">
            Entrar <IconoExterno className="size-3.5" />
          </a>
        ) : (
          <span className="inline-flex h-9 items-center rounded-ctl border border-dashed border-linea px-3.5 font-mono text-[11.5px] uppercase tracking-[.08em] text-tinta-3">Aún no publicado</span>
        )}
        <Link href={`/apps/${app.slug}`} className="inline-flex h-9 items-center gap-1.5 rounded-ctl border border-linea px-3.5 font-display text-[13px] font-semibold text-tinta-2 hover:border-white/25 hover:text-white">
          Detalle <IconoFlecha className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}

function Metrica({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-ctl border border-linea-2 px-2.5 py-2">
      <dt className="rotulo !text-[9.5px]">{k}</dt>
      <dd className="m-0 mt-1 truncate font-mono text-[12.5px] text-white">{v}</dd>
    </div>
  );
}

/** La curva de cambios por semana: área con el degradado del logo. */
function Curva({ valores }: { valores: number[] }) {
  const W = 300, H = 46, max = Math.max(1, ...valores), paso = W / (valores.length - 1);
  const pts = valores.map((v, i) => [i * paso, H - 4 - (v / max) * (H - 10)] as const);
  const linea = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-12 w-full" preserveAspectRatio="none" role="img" aria-label={`Cambios por semana: ${valores.join(", ")}`}>
      <defs>
        <linearGradient id="relleno" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#efbf01" stopOpacity=".35" /><stop offset="1" stopColor="#efbf01" stopOpacity="0" /></linearGradient>
        <linearGradient id="trazo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#efbf01" /><stop offset="1" stopColor="#d8800d" /></linearGradient>
      </defs>
      <path d={`${linea} L${W},${H} L0,${H} Z`} fill="url(#relleno)" />
      <path d={linea} fill="none" stroke="url(#trazo)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      {pts.map(([x, y], i) => valores[i] > 0 && <circle key={i} cx={x} cy={y} r="2.2" fill="#efbf01" />)}
    </svg>
  );
}
