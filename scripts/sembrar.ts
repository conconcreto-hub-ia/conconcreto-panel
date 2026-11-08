// Registra las apps del programa en el panel (idempotente por slug: actualiza textos y roles, no toca
// accesos, estado, dirección ni repo si ya se pusieron).
//
//   npx tsx scripts/sembrar.ts [organizacion-de-github]
//
// Con la organización, les pone el repo «<org>/conconcreto-<slug>» a las que no tengan.
import "./_env";
import { db } from "../src/lib/db";

const org = process.argv[2];

const APPS = [
  {
    slug: "licitaciones", nombre: "Licitaciones", orden: 1, estado: "demostracion" as const,
    resumen: "De la invitación o el SECOP al cuadro comparativo, con un agente que hace el trabajo de en medio.",
    problema: "Cada invitación a licitar llega por correo con pliegos y formularios de cantidades; armar los paquetes para BIMBAU, buscar proveedores, invitarlos y perseguir las cotizaciones se come días del equipo de licitaciones. En el SECOP, además, hay procesos que nadie alcanza a mirar.",
    duenos: "Jhon Bedoya · Licitaciones",
    roles: [
      { valor: "admin", etiqueta: "Administrador", detalle: "Todo, y maneja los usuarios" },
      { valor: "licitaciones", etiqueta: "Licitaciones", detalle: "Radar, buzón, paquetes, proveedores e invitaciones" },
      { valor: "comite", etiqueta: "Comité", detalle: "Decide si Conconcreto se presenta" },
      { valor: "consulta", etiqueta: "Consulta", detalle: "Ve todo, no cambia nada" },
    ],
  },
  {
    slug: "cierre", nombre: "El tablero del cierre", orden: 2, estado: "piloto" as const,
    resumen: "Qué sociedades del grupo ya cuadran, con qué diferencias, qué falta y de quién. Un agente persigue lo que falta.",
    problema: "El cierre de mes depende de varios procesos —la base SAP del PyG, la intercompañía, la conciliación de fiduciarias, la inversión contra patrimonio— que viven en archivos y correos de personas distintas. Saber qué falta para el comité es preguntar uno por uno.",
    duenos: "Felipe Correa · Laura Bedoya · Tatiana López",
    roles: [
      { valor: "admin", etiqueta: "Administrador", detalle: "Todo, y maneja los usuarios" },
      { valor: "contabilidad", etiqueta: "Contabilidad", detalle: "Carga archivos, corre los motores, aprueba avisos y resuelve pendientes" },
      { valor: "comite", etiqueta: "Comité", detalle: "Ve el tablero y pide el reporte" },
      { valor: "consulta", etiqueta: "Consulta", detalle: "Solo ver" },
    ],
  },
  {
    slug: "pedido-pago", nombre: "De pedido a pago", orden: 3, estado: "demostracion" as const,
    resumen: "Del pedido al pago de cada factura de proveedor, con un agente que rastrea, recalcula y responde los reclamos.",
    problema: "«¿Por qué me pagaste 90 si eran 100?». Cada reclamo de un proveedor obliga a rastrear a mano el pedido, la entrada, la causación y las retenciones —muchas veces un ReteICA aplicado en el municipio equivocado— antes de poder contestar.",
    duenos: "Jean · Cuentas por pagar",
    roles: [
      { valor: "admin", etiqueta: "Administrador", detalle: "Todo, usuarios y reglas de envío" },
      { valor: "cxp", etiqueta: "Cuentas por pagar", detalle: "Aprueba respuestas, causa, edita el ICA y cierra pendientes" },
      { valor: "tesoreria", etiqueta: "Tesorería", detalle: "Ve pagos y pendientes" },
      { valor: "consulta", etiqueta: "Consulta", detalle: "Ve todo, no cambia nada" },
    ],
  },
  {
    slug: "facturacion-caja", nombre: "Facturación y caja", orden: 4, estado: "demostracion" as const,
    resumen: "Lo proyectado, lo informado por cada proyecto y lo facturado en SAP, junto a la caja, para conversarle.",
    problema: "La proyección de facturación se arma con lo que cada proyecto dice que va a facturar, pero nadie confirma cada semana y las diferencias se descubren al cierre. La caja disponible a una fecha sale de cruzar varios Excel a mano.",
    duenos: "Marcela · Luisa · Facturación y tesorería",
    roles: [
      { valor: "admin", etiqueta: "Administrador", detalle: "Todo, y maneja los usuarios" },
      { valor: "facturacion", etiqueta: "Facturación", detalle: "Confirma con los proyectos, carga datos y aprueba justificaciones" },
      { valor: "tesoreria", etiqueta: "Tesorería", detalle: "Caja, saldos y pagos" },
      { valor: "junta", etiqueta: "Junta", detalle: "La vista de junta y la conversación" },
      { valor: "consulta", etiqueta: "Consulta", detalle: "Ve todo, no cambia nada" },
    ],
  },
];

(async () => {
  for (const a of APPS) {
    const { estado, ...textos } = a;
    const previa = await db.app.findUnique({ where: { slug: a.slug } });
    const repo = previa?.repo ?? (org ? `${org}/conconcreto-${a.slug}` : null);
    await db.app.upsert({ where: { slug: a.slug }, update: { ...textos, repo }, create: { ...textos, estado, repo } });
    console.log(`${a.nombre}${repo ? ` · ${repo}` : ""}`);
  }
})().finally(() => db.$disconnect());
