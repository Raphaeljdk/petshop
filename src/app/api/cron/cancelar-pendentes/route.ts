import { NextRequest, NextResponse } from 'next/server'
import { cancelExpiredPendingSales } from '@/lib/pending-sales'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const configured = process.env.CRON_SECRET?.trim()
  const authorization = req.headers.get('authorization')

  if (!configured || authorization !== `Bearer ${configured}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const result = await cancelExpiredPendingSales()
  return NextResponse.json({
    ok: true,
    checked: result.checked,
    cancelled: result.cancelled,
    cutoff: result.cutoff.toISOString(),
  })
}
