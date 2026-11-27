const productionCrons = [
  { path: '/api/cron/cancelar-pendentes', schedule: '15 6 * * *' },
  { path: '/api/cron/portal-notificacoes', schedule: '0 11 * * *' },
  { path: '/api/cron/marketplaces', schedule: '*/30 * * * *' },
  { path: '/api/cron/nfe-email', schedule: '*/5 * * * *' },
]

export const config = {
  buildCommand: 'bun run build',
  crons: process.env.VERCEL_ENV === 'production' ? productionCrons : [],
}
