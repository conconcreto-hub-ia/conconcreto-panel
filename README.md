# Hub de IA · Conconcreto

El centro de mando de los agentes de IA de Conconcreto: qué hace cada una, cómo va
(leído de su repo en GitHub) y quién entra a cuál. Es la puerta única: una cuenta aquí, y desde aquí se entra
a cada app sin volver a poner la clave.
Solo lleva la marca Conconcreto: es la herramienta de ellos.

## Cómo funciona la entrada a una app

```
Persona ──ingresa──▶ panel (correo y clave)
                       │  «Entrar» en una app
                       ▼
        /ir/<slug>: ¿tiene acceso? ¿con qué rol en esa app?
                       │  firma un pase (JWT HS256, 60 s, un solo uso) con PASE_SECRETO_<SLUG>
                       ▼
        <app>/api/pase?t=…  la app verifica firma, emisor, destinatario, vigencia y que no se haya usado;
                            crea o actualiza a la persona con ese rol y abre su sesión
```

- **Un secreto por app.** El panel tiene `PASE_SECRETO_LICITACIONES`, `PASE_SECRETO_CIERRE`,
  `PASE_SECRETO_PEDIDO_PAGO`, `PASE_SECRETO_FACTURACION_CAJA`; cada app tiene el suyo como `PANEL_PASE_SECRETO`,
  más `PANEL_APP=<slug>`. Quien consiga el de una app no abre las otras. **Si se rota, se cambia en los dos lados.**
- **El panel manda sobre quién entra.** Quitar un acceso o desactivar a alguien llama a `<app>/api/pase/retirar`
  (servidor a servidor, con un pase de tipo «retiro»): la app la desactiva y le cierra las sesiones. Si la app no
  contesta, el panel lo dice en pantalla; la persona igual ya no puede entrar desde el panel.
- **Las personas que entran por el panel no tienen clave en la app.** Su hash es `pase:sin-clave-propia`. El
  ingreso con clave de cada app sigue existiendo para su propio administrador.
- **Tres roles en el hub** (`src/lib/auth/permisos.ts`): superadministrador (todo; entra a todos los agentes como
  administrador; el único que nombra administradores o superadministradores o toca a otro superadministrador; siempre
  queda al menos uno), administrador (agrega personas, da accesos y acceso al código; entra solo a los agentes que
  tenga) y miembro. Las reglas viven en las acciones (`src/app/acceso.ts`, `src/app/accesos.ts`), no en la pantalla: se
  probó inyectando la opción «Superadministrador» como administrador y el servidor lo rechaza.
- Los roles dentro de cada agente los guarda `App.roles`, sembrados en `scripts/sembrar.ts`.

## El acceso al código

Cada persona tiene su usuario de GitHub (se comprueba que exista). Debajo de su rol en cada agente se elige «Ve el
código» o «Edita el código» y el hub la deja como colaboradora del repo (`src/lib/github-admin.ts`); GitHub le manda la
invitación. Quitarle el acceso al agente, cambiarle el usuario o desactivarla la saca del repo y cancela la invitación
pendiente. Para eso usa **`GITHUB_ADMIN_TOKEN`** (fine-grained de la organización, Administration en lectura y
escritura): es distinto de `GITHUB_TOKEN`, el de solo lectura que usa cada carga del centro de mando.

## El avance

Sale de GitHub (`src/lib/github.ts`): cambios por semana, lo último que cambió, tareas (issues) abiertas y
cerradas, hitos (milestones) y la última publicación. Las respuestas se guardan 5 minutos; nada sondea de fondo.
`GITHUB_TOKEN`: un token **fine-grained** de la organización, solo lectura de Contents, Metadata, Issues y
Deployments. Sin token el panel funciona y dice que no hay avance.

Para que el avance diga algo, el equipo trabaja con issues y milestones en cada repo. Jaime, como administrador
de la organización en GitHub, invita a quien vaya a tocar código; el panel no maneja permisos de GitHub.

## Correr

```bash
npm install
npx prisma db push && npx prisma generate
npx tsx scripts/sembrar.ts <organizacion-github>   # las apps, sus roles y sus repos
npx tsx scripts/crear-usuario.ts <correo> "<Nombre>" admin
npm run dev                                         # http://localhost:3015
```

`.env.local` (fuera de git): `DATABASE_URL` (Neon, `sslmode=verify-full`), `SESION_SECRETO`, los cuatro
`PASE_SECRETO_*` y `GITHUB_TOKEN`. La dirección de cada app se pone en su ficha (`/apps/<slug>`, solo https).

## Verificar

```bash
npm run check   # typecheck + pruebas (claves, cookie, permisos, destino, cambios por semana)
```

Cada app prueba su lado del pase en `src/lib/__tests__/pase.test.ts` (bueno, reusado, de otra app, otro
secreto, otro emisor, vencido, de retiro, rol que no existe). Se probó de punta a punta en local: entrar a
Licitaciones desde el panel, el pase reusado rechazado, uno firmado con otro secreto rechazado, dar y quitar
acceso desde `/personas` con su registro en la bitácora y el retiro aplicado en la app.

## Las reglas que no se tocan

- **Todo cerrado** salvo `/ingresar` (`src/proxy.ts`). `/ir/<slug>` pide sesión.
- **Cookie `panel_sesion`**: un nombre por app, porque en `localhost` las cookies no distinguen puerto.
- **Cada acción exige su permiso** (`exigir()`), aunque la pantalla esconda el botón.
