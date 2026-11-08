"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton, Tarjeta } from "@/components/ui";
import { accionEditarApp } from "@/app/accesos";

const campo = "mt-1 h-9 w-full rounded-ctl border border-linea bg-fondo px-3 text-[13.5px] outline-none focus:border-verde";
const ESTADOS = [["construccion", "En construcción"], ["demostracion", "Demostración"], ["piloto", "Piloto"], ["operacion", "En operación"]];

export function EditorApp({ id, estado, url, repo }: { id: string; estado: string; url: string; repo: string }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [d, setD] = useState({ estado, url, repo });
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Tarjeta className="p-5">
      <h3 className="text-[15px] font-bold">Editar la ficha</h3>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => { e.preventDefault(); empezar(async () => { setMsg(null); try { await accionEditarApp(id, d); setMsg("Guardado."); router.refresh(); } catch (er) { setMsg(er instanceof Error ? er.message : String(er)); } }); }}
      >
        <label className="block text-[13px] font-semibold">Estado
          <select value={d.estado} onChange={(e) => setD({ ...d, estado: e.target.value })} className={campo}>{ESTADOS.map(([v, et]) => <option key={v} value={v}>{et}</option>)}</select>
        </label>
        <label className="block text-[13px] font-semibold">Dirección<input value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} placeholder="https://…" className={campo} /></label>
        <label className="block text-[13px] font-semibold">Repo en GitHub<input value={d.repo} onChange={(e) => setD({ ...d, repo: e.target.value })} placeholder="organizacion/nombre" className={campo} /></label>
        {msg && <p className="text-[12.5px] text-tinta-2">{msg}</p>}
        <Boton type="submit" disabled={pendiente} className="w-full">{pendiente ? "Guardando…" : "Guardar"}</Boton>
      </form>
    </Tarjeta>
  );
}
