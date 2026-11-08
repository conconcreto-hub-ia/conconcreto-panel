import { redirect } from "next/navigation";
import { Barra } from "@/components/barra";
import { Contenedor, Encabezado, Insignia, Tarjeta } from "@/components/ui";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede, ROL } from "@/lib/auth/permisos";
import { db } from "@/lib/db";
import { rolesDe } from "@/lib/apps";
import { haceCuanto } from "@/lib/formato";
import { FormNuevoUsuario, FilaAcciones, SelectorAcceso } from "./controles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Personas · Hub de IA Conconcreto" };

export default async function Personas() {
  const yo = await exigirSesion();
  if (!puede(yo.rol, "usuarios.administrar")) redirect("/");
  const [usuarios, apps] = await Promise.all([
    db.usuario.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }], include: { accesos: true } }),
    db.app.findMany({ orderBy: { orden: "asc" } }),
  ]);

  return (
    <>
      <Barra />
      <Contenedor className="space-y-6 py-10">
        <Encabezado
          et="Personas"
          titulo="Quién opera cada agente"
          bajada="Cada persona tiene una sola cuenta, la del hub. Desde aquí decides a qué agente entra y con qué rol dentro de él. Quitar un acceso o desactivar a alguien le cierra la sesión también en el agente."
        />
        <div className="space-y-6">
          <Tarjeta className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[980px] text-[14px]">
              <thead>
                <tr className="text-left text-[12px] text-tinta-3">
                  <th className="px-5 py-3 font-medium">Persona</th>
                  {apps.map((a) => <th key={a.id} className="px-2 py-3 font-medium">{a.nombre}</th>)}
                  <th className="px-3 py-3 font-medium">En el hub</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className={`border-t border-linea-2 align-top ${u.activo ? "" : "opacity-55"}`}>
                    <td className="px-5 py-3">
                      <div className="font-semibold">{u.nombre}{u.id === yo.id && <span className="ml-1.5 text-[12px] font-normal text-tinta-3">(tú)</span>}</div>
                      <div className="text-[12.5px] text-tinta-3">{u.cargo ? `${u.cargo} · ` : ""}{u.correo}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {!u.activo && <Insignia tono="neutro">Desactivado</Insignia>}
                        {u.debeCambiarClave && u.activo && <Insignia tono="oro">Clave temporal</Insignia>}
                        <span className="text-[12px] text-tinta-3">{u.ultimoIngreso ? `Entró ${haceCuanto(u.ultimoIngreso)}` : "No ha entrado"}</span>
                      </div>
                    </td>
                    {apps.map((a) => (
                      <td key={a.id} className="px-2 py-3">
                        {u.rol === "admin"
                          ? <span className="text-[12.5px] text-tinta-3" title="El administrador del hub entra a todos como administrador">Todos (admin)</span>
                          : <SelectorAcceso usuarioId={u.id} appId={a.id} nombreApp={a.nombre} rol={u.accesos.find((x) => x.appId === a.id)?.rol ?? ""} roles={rolesDe(a)} />}
                      </td>
                    ))}
                    <td className="px-3 py-3"><FilaAcciones id={u.id} rol={u.rol} activo={u.activo} soyYo={u.id === yo.id} soloRol /></td>
                    <td className="px-5 py-3"><FilaAcciones id={u.id} rol={u.rol} activo={u.activo} soyYo={u.id === yo.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
          <aside className="grid items-start gap-4 md:grid-cols-2">
            <Tarjeta className="p-5">
              <h3 className="text-[16px] font-bold">Agregar a alguien</h3>
              <FormNuevoUsuario />
            </Tarjeta>
            <Tarjeta className="p-5">
              <h3 className="text-[15px] font-bold">En el hub</h3>
              <ul className="mt-2 space-y-2 pl-0">
                {Object.values(ROL).map((r) => <li key={r.etiqueta} className="list-none text-[13.5px]"><b className="font-display font-semibold">{r.etiqueta}</b> <span className="text-tinta-2">· {r.detalle}</span></li>)}
              </ul>
              <p className="mt-3 text-[12.5px] text-tinta-3">El rol dentro de cada agente (por ejemplo «Comité» en Licitaciones) se elige en su columna. Cada agente explica sus roles en su detalle.</p>
            </Tarjeta>
          </aside>
        </div>
      </Contenedor>
    </>
  );
}
