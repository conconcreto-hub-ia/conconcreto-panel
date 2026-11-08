// Qué puede hacer cada rol del panel. Un solo lugar: las acciones lo exigen y las pantallas lo consultan.
// El rol dentro de cada app es otra cosa: vive en Acceso.rol y lo aplica la app.
import type { Rol } from "@prisma/client";

export const PERMISOS = {
  ver: ["admin", "miembro"],
  "usuarios.administrar": ["admin"],
  "accesos.administrar": ["admin"],
  "apps.editar": ["admin"],
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof PERMISOS;

export const puede = (rol: Rol | null | undefined, p: Permiso) => !!rol && (PERMISOS[p] as readonly Rol[]).includes(rol);

export const ROL: Record<Rol, { etiqueta: string; detalle: string }> = {
  admin: { etiqueta: "Administrador", detalle: "Agrega personas y decide a qué app entra cada una" },
  miembro: { etiqueta: "Miembro", detalle: "Entra a las apps que le dieron, con el rol que le dieron" },
};
