// Las apps y sus roles. Las etiquetas del estado viven aquí y en ningún otro sitio.
import type { Tono } from "./etiquetas";
import type { App, EstadoApp } from "@prisma/client";

export type RolApp = { valor: string; etiqueta: string; detalle: string };

export const rolesDe = (app: Pick<App, "roles">): RolApp[] => (Array.isArray(app.roles) ? (app.roles as RolApp[]) : []);

export const ESTADO: Record<EstadoApp, { etiqueta: string; tono: Tono; detalle: string }> = {
  construccion: { etiqueta: "En construcción", tono: "neutro", detalle: "Se está construyendo" },
  demostracion: { etiqueta: "Demostración", tono: "oro", detalle: "Corre con datos de demostración" },
  piloto: { etiqueta: "Piloto", tono: "noche", detalle: "La usa su dueño con sus datos" },
  operacion: { etiqueta: "En operación", tono: "verde", detalle: "En uso de verdad" },
};
