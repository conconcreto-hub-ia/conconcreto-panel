# Hub de IA · Conconcreto

Next.js 16 (webpack) + React 19 + Tailwind 4 + Prisma 7 sobre Neon. Puerto 3015. El sistema de diseño y el
acceso salen de `conconcreto-licitaciones`: si cambias uno, piensa en los otros.

Cada agente es independiente (su repo, su inicio de sesión): el hub no entra por ellos. Lee `README.md`.

- Español neutro con tuteo; nunca «JP»; sin emojis.
- Credenciales solo en `.env.local` (fuera de git) y en Vercel.
- Después de cambiar `prisma/schema.prisma`: `npx prisma generate` y reiniciar el servidor.
- `npm run check` antes de cada commit.
