# Hub de IA · Conconcreto

El centro de mando de los agentes de IA de Conconcreto: qué hace cada una, cómo va
(leído de su repo en GitHub) y quién entra a cuál. Es la puerta única: una cuenta aquí, y desde aquí se entra
a cada app sin volver a poner la clave.
Solo lleva la marca Conconcreto: es la herramienta de ellos.

## Cada agente es independiente

Cada agente es su propio repo y tiene **su propio inicio de sesión**: sus usuarios y roles los maneja su equipo
dentro del agente. El hub **no** entra por ellos (hasta el 9-nov-2026 lo hacía con un pase firmado; se quitó a
propósito para que cada persona o equipo pueda ajustar su agente sin depender del hub). «Entrar» abre el agente
en una pestaña nueva, en su pantalla de ingreso, y los agentes no tienen enlace de vuelta al hub.

Lo que sí hace el hub: mostrar cómo va cada agente (si está arriba y su avance en GitHub) y manejar **quién ve o
edita el código** de cada uno.

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

`.env.local` (fuera de git): `DATABASE_URL` (Neon, `sslmode=verify-full`), `SESION_SECRETO`, `GITHUB_TOKEN` (lectura)
y `GITHUB_ADMIN_TOKEN` (invitar y retirar del código). La dirección de cada app se pone en su ficha (`/apps/<slug>`, solo https).

## Verificar

```bash
npm run check   # typecheck + pruebas (claves, cookie, permisos, destino, cambios por semana)
```

Se probó en local: crear y cambiar roles con las reglas de superadministrador (el servidor rechaza a un administrador
que intenta nombrar a otro), validar el usuario de GitHub contra GitHub y que el token de administración no lea código.

## Las reglas que no se tocan

- **Todo cerrado** salvo `/ingresar` (`src/proxy.ts`). `/ir/<slug>` pide sesión.
- **Cookie `panel_sesion`**: un nombre por app, porque en `localhost` las cookies no distinguen puerto.
- **Cada acción exige su permiso** (`exigir()`), aunque la pantalla esconda el botón.
