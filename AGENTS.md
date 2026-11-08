# Panel de apps · Conconcreto

Next.js 16 (webpack) + React 19 + Tailwind 4 + Prisma 7 sobre Neon. Puerto 3015. El sistema de diseño y el
acceso salen de `conconcreto-licitaciones`: si cambias uno, piensa en los otros.

Lee `README.md` antes de tocar la entrada a las apps (`src/lib/pase.ts`, `src/app/ir/[slug]/route.ts`): el
pase tiene su contraparte en cada app (`src/lib/auth/pase.ts`, `src/app/api/pase/**`) y los dos lados tienen
que coincidir en emisor (`conconcreto-panel`), destinatario (el slug), algoritmo y secreto.

- Español neutro con tuteo; nunca «JP»; sin emojis.
- Credenciales solo en `.env.local` (fuera de git) y en Vercel.
- Después de cambiar `prisma/schema.prisma`: `npx prisma generate` y reiniciar el servidor.
- `npm run check` antes de cada commit.
