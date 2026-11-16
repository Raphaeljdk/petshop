import { NextRequest, NextResponse } from 'next/server'
import { cancelExpiredPendingSales } from '@/lib/pending-sales'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// Cancelamento diário independente. Estoque/marketplaces têm cron próprio
// para não sincronizar antes de registrar vendas nem duplicar as chamadas.
export async function GET(req: NextRequest) {
  const configured = process.env.CRON_SECRET?.trim()
  if (!configured || req.headers.get('authorization') !== 'Bearer '+configured)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const pending = await cancelExpiredPendingSales()
  return NextResponse.json({ok:true,pending:{
    checked:pending.checked,cancelled:pending.cancelled,
    cutoff:pending.cutoff.toISOString(),
  }})
}
