// Qué puede hacer cada rol del hub. Un solo lugar: las acciones lo exigen y las pantallas lo consultan.
// El rol dentro de cada agente es otra cosa: vive en Acceso.rol y lo aplica el agente.
import type { Rol } from "@prisma/client";

export const PERMISOS = {
  ver: ["superadmin", "admin", "miembro"],
  "usuarios.administrar": ["superadmin", "admin"],
  "accesos.administrar": ["superadmin", "admin"],
  "github.administrar": ["superadmin", "admin"],
  "apps.editar": ["superadmin"],
  // Nombrar administradores o superadministradores, o tocar a un superadministrador.
  "roles.privilegiados": ["superadmin"],
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof PERMISOS;

export const puede = (rol: Rol | null | undefined, p: Permiso) => !!rol && (PERMISOS[p] as readonly Rol[]).includes(rol);

/** Administra el hub (personas y accesos): superadministrador o administrador. */
export const administra = (rol: Rol | null | undefined) => puede(rol, "usuarios.administrar");

export const ROL: Record<Rol, { etiqueta: string; detalle: string }> = {
  superadmin: { etiqueta: "Superadministrador", detalle: "Todo, y es el único que nombra administradores" },
  admin: { etiqueta: "Administrador", detalle: "Agrega personas y decide quién ve o edita el código de cada agente" },
  miembro: { etiqueta: "Miembro", detalle: "Ve el centro de mando: cómo va cada agente" },
};
