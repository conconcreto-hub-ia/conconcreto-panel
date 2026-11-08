import { redirect } from "next/navigation";
import { Barra } from "@/components/barra";
import { Contenedor, Encabezado, Insignia, Tarjeta } from "@/components/ui";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede, ROL } from "@/lib/auth/permisos";
import { db } from "@/lib/db";
import { rolesDe } from "@/lib/apps";
import { haceCuanto } from "@/lib/formato";
import { githubAdminListo } from "@/lib/github-admin";
import { FormNuevoUsuario, FilaAcciones, CeldaAcceso, SelectorRol, CampoGithub } from "./controles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Personas · Hub de IA Conconcreto" };

const ORDEN = { superadmin: 0, admin: 1, miembro: 2 } as const;

export default async function Personas() {
  const yo = await exigirSesion();
  if (!puede(yo.rol, "usuarios.administrar")) redirect("/");
  const soySuper = puede(yo.rol, "roles.privilegiados");
  const [usuarios, apps] = await Promise.all([
    db.usuario.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }], include: { accesos: true } }),
    db.app.findMany({ orderBy: { orden: "asc" } }),
  ]);
  usuarios.sort((a, b) => Number(b.activo) - Number(a.activo) || ORDEN[a.rol] - ORDEN[b.rol]);
  const ghListo = githubAdminListo();

  return (
    <div className="grilla min-h-screen">
      <Barra />
      <Contenedor className="space-y-6 py-10">
        <Encabezado
          et="Personas"
          titulo="Quién opera cada agente"
          bajada="Cada persona tiene una sola cuenta, la del hub. Aquí decides a qué agente entra, con qué rol dentro de él y si ve o edita su código en GitHub. Quitar un acceso o desactivar a alguien le cierra la sesión en el agente y lo saca del repo."
        />
        {!ghListo && (
          <p className="rounded-ctl border border-oro/30 bg-oro-suave px-4 py-3 text-[13.5px] text-tinta-2">
            El acceso al código todavía no se puede aplicar: el hub necesita un permiso de administración en GitHub (<span className="font-mono">GITHUB_ADMIN_TOKEN</span>). Los usuarios de GitHub sí se pueden ir guardando.
          </p>
        )}
        <Tarjeta className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[1180px] text-[14px]">
            <thead>
              <tr className="text-left text-[12px] text-tinta-3">
                <th className="px-5 py-3 font-medium">Persona</th>
                <th className="px-2 py-3 font-medium">En el hub</th>
                <th className="px-2 py-3 font-medium">GitHub</th>
                {apps.map((a) => <th key={a.id} className="px-2 py-3 font-medium">{a.nombre}</th>)}
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const bloqueado = u.rol === "superadmin" && !soySuper;
                return (
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
                    <td className="px-2 py-3"><SelectorRol id={u.id} rol={u.rol} soyYo={u.id === yo.id} soySuper={soySuper} /></td>
                    <td className="px-2 py-3"><CampoGithub id={u.id} valor={u.github ?? ""} bloqueado={bloqueado} /></td>
                    {apps.map((a) => {
                      const acc = u.accesos.find((x) => x.appId === a.id);
                      return (
                        <td key={a.id} className="px-2 py-3">
                          <CeldaAcceso
                            usuarioId={u.id} appId={a.id} nombreApp={a.nombre} roles={rolesDe(a)}
                            rol={acc?.rol ?? ""} codigo={acc?.codigo ?? "ninguno"} codigoNota={acc?.codigoNota ?? null}
                            tieneGithub={!!u.github} tieneRepo={!!a.repo && ghListo} esSuper={u.rol === "superadmin"} bloqueado={bloqueado}
                          />
                        </td>
                      );
                    })}
                    <td className="px-5 py-3"><FilaAcciones id={u.id} activo={u.activo} soyYo={u.id === yo.id} bloqueado={bloqueado} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Tarjeta>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Tarjeta className="p-5">
            <h3 className="text-[16px] font-bold">Agregar a alguien</h3>
            <FormNuevoUsuario soySuper={soySuper} />
          </Tarjeta>
          <Tarjeta className="p-5">
            <h3 className="text-[15px] font-bold">Los roles en el hub</h3>
            <ul className="mt-2 space-y-2 pl-0">
              {Object.values(ROL).map((r) => <li key={r.etiqueta} className="list-none text-[13.5px]"><b className="font-display font-semibold">{r.etiqueta}</b> <span className="text-tinta-2">· {r.detalle}</span></li>)}
            </ul>
            <p className="mt-3 text-[12.5px] text-tinta-3">Debajo del rol de cada agente se elige el acceso al código: «Ve el código» o «Edita el código». GitHub le manda una invitación a la persona, que la acepta desde su correo.</p>
          </Tarjeta>
        </div>
      </Contenedor>
    </div>
  );
}
