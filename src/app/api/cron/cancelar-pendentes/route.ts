import { NextRequest, NextResponse } from 'next/server'
import { cancelExpiredPendingSales } from '@/lib/pending-sales'
import { syncMarketplaceSalesToZetta } from '@/lib/marketplace-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const configured = process.env.CRON_SECRET?.trim()
  const authorization = req.headers.get('authorization')

  if (!configured || authorization !== `Bearer ${configured}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const [pending, marketplaces] = await Promise.all([
    cancelExpiredPendingSales(),
    syncMarketplaceSalesToZetta(),
  ])

  return NextResponse.json({
    ok: true,
    pending: {
      checked: pending.checked,
      cancelled: pending.cancelled,
      cutoff: pending.cutoff.toISOString(),
    },
    marketplaces,
  })
}
