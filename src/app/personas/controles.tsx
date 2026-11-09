"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui";
import { accionCrearUsuario, accionCambiarRol, accionActivar, accionNuevaClave, accionGithub } from "@/app/acceso";
import { accionCodigo } from "@/app/accesos";
import type { Rol } from "@prisma/client";

const TODOS: { v: Rol; e: string }[] = [{ v: "miembro", e: "Miembro" }, { v: "admin", e: "Administrador" }, { v: "superadmin", e: "Superadministrador" }];
/** Un administrador solo crea miembros; un superadministrador, cualquier rol. */
const rolesQuePuede = (soySuper: boolean) => (soySuper ? TODOS : TODOS.filter((r) => r.v === "miembro"));
const campo = "mt-1 h-10 w-full rounded-ctl border border-linea bg-fondo px-3 text-[14px] outline-none focus:border-verde";

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** La clave temporal se ve una sola vez: hay que copiarla y entregarla por un canal seguro. */
function ClaveUnaVez({ correo, clave }: { correo: string; clave: string }) {
  return (
    <div className="rounded-ctl border border-oro/60 bg-oro-suave p-3 text-[13px]">
      <div className="font-semibold">Clave temporal de {correo}</div>
      <div className="mt-1 select-all font-mono text-[16px] font-semibold tracking-wide">{clave}</div>
      <div className="mt-1 text-tinta-2">Cópiala ahora: no se vuelve a mostrar. Entrégala por un canal seguro, no por el mismo correo.</div>
    </div>
  );
}

export function FormNuevoUsuario({ soySuper }: { soySuper: boolean }) {
  const [estado, accion, pendiente] = useActionState(accionCrearUsuario, {});
  return (
    <form action={accion} className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="block text-[13px] font-semibold">Nombre<input name="nombre" required className={campo} /></label>
      <label className="block text-[13px] font-semibold">Correo<input name="correo" type="email" required className={campo} /></label>
      <label className="block text-[13px] font-semibold">Cargo <span className="font-normal text-tinta-3">(opcional)</span><input name="cargo" className={campo} /></label>
      <label className="block text-[13px] font-semibold">Usuario de GitHub <span className="font-normal text-tinta-3">(opcional)</span><input name="github" placeholder="sin @" className={campo} /></label>
      <label className="block text-[13px] font-semibold sm:col-span-2">Rol en el hub
        <select name="rol" defaultValue="miembro" className={campo}>{rolesQuePuede(soySuper).map((r) => <option key={r.v} value={r.v}>{r.e}</option>)}</select>
      </label>
      <div className="space-y-3 sm:col-span-2">
        {estado.error && <p role="alert" className="text-[13px] text-rojo">{estado.error}</p>}
        {estado.creado && <ClaveUnaVez {...estado.creado} />}
        <Boton type="submit" variante="primario" disabled={pendiente} className="w-full">{pendiente ? "Creando…" : "Crear usuario"}</Boton>
      </div>
    </form>
  );
}

/** El rol en el hub. Un administrador no puede tocar roles privilegiados; nadie, el suyo. */
export function SelectorRol({ id, rol, soyYo, soySuper }: { id: string; rol: Rol; soyYo: boolean; soySuper: boolean }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bloqueado = soyYo || (!soySuper && rol !== "miembro");
  const opciones = soySuper ? TODOS : TODOS.filter((r) => r.v === "miembro" || r.v === rol);
  return (
    <div>
      <select
        value={rol}
        disabled={pendiente || bloqueado}
        onChange={(e) => empezar(async () => { setError(null); try { await accionCambiarRol(id, e.target.value as Rol); router.refresh(); } catch (er) { setError(mensaje(er)); } })}
        className={"h-8 rounded-ctl border px-2 text-[13px] disabled:opacity-70 " + (rol === "superadmin" ? "border-oro/50 bg-oro-suave font-semibold text-oro" : rol === "admin" ? "border-verde/40 bg-verde-suave text-verde-profundo" : "border-linea bg-papel")}
        title={soyYo ? "No puedes cambiar tu propio rol" : bloqueado ? "Solo un superadministrador cambia este rol" : ""}
      >
        {opciones.map((r) => <option key={r.v} value={r.v}>{r.e}</option>)}
      </select>
      {error && <p className="mt-1 max-w-[180px] text-[11.5px] text-rojo">{error}</p>}
    </div>
  );
}

/** El usuario de GitHub de la persona, editable en la misma fila. */
export function CampoGithub({ id, valor, bloqueado }: { id: string; valor: string; bloqueado: boolean }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [texto, setTexto] = useState(valor);
  const [msg, setMsg] = useState<{ t: string; error?: boolean } | null>(null);
  const guardar = () => {
    if (texto.trim().replace(/^@/, "") === valor) return;
    empezar(async () => { setMsg(null); try { const r = await accionGithub(id, texto); setMsg(r.aviso ? { t: r.aviso } : { t: "Guardado" }); router.refresh(); } catch (e) { setMsg({ t: mensaje(e), error: true }); setTexto(valor); } });
  };
  return (
    <div className="min-w-[140px]">
      <div className="flex h-8 items-center rounded-ctl border border-linea bg-papel pl-2 focus-within:border-verde">
        <span className="font-mono text-[12.5px] text-tinta-3">@</span>
        <input
          aria-label="Usuario de GitHub"
          value={texto}
          disabled={pendiente || bloqueado}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder="usuario"
          className="h-full w-full min-w-0 bg-transparent px-1 font-mono text-[12.5px] outline-none disabled:opacity-60"
        />
      </div>
      {pendiente && <p className="mt-1 text-[11.5px] text-tinta-3">Revisando en GitHub…</p>}
      {msg && <p className={"mt-1 max-w-[180px] text-[11.5px] " + (msg.error ? "text-rojo" : "text-tinta-3")}>{msg.t}</p>}
    </div>
  );
}

export function FilaAcciones({ id, activo, soyYo, bloqueado }: { id: string; activo: boolean; soyYo: boolean; bloqueado: boolean }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [clave, setClave] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const correr = (fn: () => Promise<unknown>) => empezar(async () => { setError(null); try { await fn(); router.refresh(); } catch (e) { setError(mensaje(e)); } });
  if (bloqueado) return <span className="text-[12px] text-tinta-3">Solo un superadministrador</span>;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Boton chico variante="secundario" disabled={pendiente} onClick={() => correr(async () => setClave((await accionNuevaClave(id)).clave))}>Nueva clave</Boton>
        {!soyYo && <Boton chico variante={activo ? "peligro" : "secundario"} disabled={pendiente} onClick={() => correr(() => accionActivar(id, !activo))}>{activo ? "Desactivar" : "Activar"}</Boton>}
      </div>
      {clave && <div className="max-w-[300px] text-left"><ClaveUnaVez correo="esta persona" clave={clave} /></div>}
      {error && <p className="max-w-[220px] text-[12.5px] text-rojo">{error}</p>}
    </div>
  );
}

const NIVELES = [{ v: "ninguno", e: "Sin código" }, { v: "lectura", e: "Ve el código" }, { v: "escritura", e: "Edita el código" }] as const;

/** El acceso al código de un agente en GitHub: sin código, ve o edita. Al cambiarlo, el hub la invita al repo o la saca. */
export function CeldaAcceso(p: { usuarioId: string; appId: string; nombreApp: string; codigo: string; codigoNota: string | null; tieneGithub: boolean; tieneRepo: boolean; bloqueado: boolean }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [aviso, setAviso] = useState<{ t: string; error?: boolean } | null>(null);
  return (
    <div className="space-y-1.5">
      <select
        aria-label={`Código de ${p.nombreApp}`}
        value={p.codigo}
        disabled={pendiente || p.bloqueado || !p.tieneGithub || !p.tieneRepo}
        title={!p.tieneGithub ? "Primero pon su usuario de GitHub" : !p.tieneRepo ? "El agente no tiene repo o el hub no tiene permiso en GitHub" : p.codigoNota ?? ""}
        onChange={(e) => { const v = e.target.value as "ninguno" | "lectura" | "escritura"; empezar(async () => { setAviso(null); try { const r = await accionCodigo(p.usuarioId, p.appId, v); setAviso({ t: r.nota }); router.refresh(); } catch (er) { setAviso({ t: mensaje(er), error: true }); } }); }}
        className={"h-8 w-full min-w-[132px] rounded-ctl border px-2 text-[13px] disabled:opacity-50 " + (p.codigo === "ninguno" ? "border-linea bg-papel text-tinta-3" : p.codigo === "escritura" ? "border-oro/40 bg-oro-suave font-semibold text-oro" : "border-verde/50 bg-verde-suave font-semibold text-verde-profundo")}
      >
        {NIVELES.map((n) => <option key={n.v} value={n.v}>{n.e}</option>)}
      </select>
      {pendiente && <p className="text-[11px] text-tinta-3">Aplicando en GitHub…</p>}
      {aviso && <p className={"max-w-[190px] text-[11.5px] " + (aviso.error ? "text-rojo" : "text-tinta-3")}>{aviso.t}</p>}
    </div>
  );
}
