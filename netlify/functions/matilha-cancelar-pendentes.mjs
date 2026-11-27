import { executarCron } from '../lib/cron.mjs'
export const handler=()=>executarCron('/api/cron/cancelar-pendentes')
