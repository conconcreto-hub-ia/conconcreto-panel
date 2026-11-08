"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Marca, Contenedor } from "./ui";
import { accionSalir } from "@/app/acceso";

// El menú vive aquí y en ningún otro sitio.
export const NAV = [
  { href: "/", etiqueta: "Centro de mando" },
  { href: "/personas", etiqueta: "Personas", soloAdmin: true },
  { href: "/bitacora", etiqueta: "Bitácora", soloAdmin: true },
] as const;

/** La hora de Bogotá, segundo a segundo. Solo pinta: no consulta nada. */
function Reloj() {
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    setAhora(new Date());
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hora = ahora?.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Bogota" }) ?? "--:--:--";
  const dia = ahora?.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Bogota" }) ?? "";
  return (
    <div className="hidden items-center gap-2.5 font-mono text-[12px] text-white/60 md:flex">
      <span className="uppercase tracking-[.12em]">{dia}</span>
      <span className="tabular text-white/90">{hora}</span>
      <span className="text-white/35">BOG</span>
    </div>
  );
}

export function BarraCliente({ children, usuario }: { agenteActivo?: boolean; children?: ReactNode; usuario: { nombre: string; rol: string; esAdmin: boolean } | null }) {
  const ruta = usePathname();
  const activo = (href: string) => (href === "/" ? ruta === "/" || ruta.startsWith("/apps") : ruta.startsWith(href));
  const items = NAV.filter((n) => !("soloAdmin" in n) || usuario?.esAdmin);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[.08] bg-[#050d08]/80 backdrop-blur-md">
      <Contenedor className="flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-7">
          <Link href="/" aria-label="Centro de mando"><Marca compacta /></Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
            {items.map((n) => (
              <Link key={n.href} href={n.href} className={"rounded-ctl px-3 py-1.5 font-display text-[13.5px] font-semibold transition-colors " + (activo(n.href) ? "bg-white/[.08] text-white" : "text-white/50 hover:text-white/85")}>
                {n.etiqueta}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Reloj />
          {usuario && (
            <div className="flex items-center gap-1 sm:border-l sm:border-white/10 sm:pl-4">
              <Link href="/cuenta" className="hidden rounded-ctl px-2.5 py-1 text-right leading-tight hover:bg-white/[.06] sm:block">
                <div className="text-[13px] font-semibold text-white">{usuario.nombre}</div>
                <div className="font-mono text-[10.5px] uppercase tracking-[.12em] text-white/45">{usuario.rol}</div>
              </Link>
              <form action={accionSalir}>
                <button type="submit" className="rounded-ctl px-2.5 py-2 font-display text-[12.5px] font-semibold text-white/50 hover:bg-white/[.06] hover:text-white">Salir</button>
              </form>
            </div>
          )}
        </div>
      </Contenedor>
      <Contenedor className="lg:hidden">
        <nav className="flex gap-1 overflow-x-auto pb-2" aria-label="Principal">
          {items.map((n) => (
            <Link key={n.href} href={n.href} className={"whitespace-nowrap rounded-ctl px-3 py-1.5 font-display text-[13px] font-semibold " + (activo(n.href) ? "bg-white/[.08] text-white" : "text-white/50")}>{n.etiqueta}</Link>
          ))}
        </nav>
      </Contenedor>
      {children}
    </header>
  );
}
