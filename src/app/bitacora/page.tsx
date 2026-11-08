import { redirect } from "next/navigation";
import { Barra } from "@/components/barra";
import { Contenedor, Encabezado, Tarjeta, Vacio } from "@/components/ui";
import { exigirSesion } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/permisos";
import { db } from "@/lib/db";
import { haceCuanto } from "@/lib/formato";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bitácora · Panel Conconcreto" };

const TIPO: Record<string, string> = {
  "acceso.otorgado": "Dio acceso", "acceso.cambiado": "Cambió el rol", "acceso.retirado": "Quitó el acceso",
  "app.entrada": "Entró", "app.editada": "Editó la ficha", "usuario.desactivado": "Desactivó",
};

export default async function Bitacora() {
  const yo = await exigirSesion();
  if (!puede(yo.rol, "accesos.administrar")) redirect("/");
  const eventos = await db.evento.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <Barra />
      <Contenedor className="space-y-5 py-10">
        <Encabezado et="Bitácora" titulo="Quién dio acceso, quién entró" bajada="Los últimos 200 movimientos, con el nombre de quien los hizo." />
        {eventos.length === 0 ? <Vacio titulo="Sin movimientos todavía" /> : (
          <Tarjeta className="divide-y divide-linea-2">
            {eventos.map((e) => (
              <div key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-[14px]">
                <div><b className="font-display font-semibold">{e.quien}</b> <span className="text-tinta-3">· {TIPO[e.tipo] ?? e.tipo}</span> <span className="text-tinta-2">· {e.detalle}</span></div>
                <span className="text-[12.5px] text-tinta-3">{haceCuanto(e.createdAt)}</span>
              </div>
            ))}
          </Tarjeta>
        )}
      </Contenedor>
    </>
  );
}
