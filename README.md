# Matilha Prado

Sistema completo para gestão de pet shop, com painel administrativo, agenda, Kanban de atendimentos, estoque, vendas, entregas, pagamentos e portal do cliente.

## Tecnologias

- Next.js 16 e React 19
- TypeScript e Tailwind CSS
- Prisma ORM
- Mercado Pago
- Socket.IO

## Executar localmente

1. Copie `.env.example` para `.env`.
2. Defina uma chave segura em `NEXTAUTH_SECRET`.
3. Execute:

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Abra `http://localhost:3000`.

## Publicação

O projeto exige um banco persistente. O SQLite local é adequado para desenvolvimento, mas deve ser substituído por PostgreSQL ou outro banco gerenciado antes de liberar cadastros reais na Vercel.

Nunca envie `.env`, bancos locais, contratos ou credenciais ao repositório.
