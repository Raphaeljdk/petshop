import { NextRequest, NextResponse } from 'next/server'
import { mercadoLivreAccessToken } from '@/lib/mercado-livre'
import { syncMarketplaceSalesToZetta } from '@/lib/marketplace-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  let body: {
    user_id?: number | string
    topic?: string
    resource?: string
  } = {}

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: true, ignored: true })
  }

  if (body.topic && body.topic !== 'orders_v2') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  try {
    const { sellerId } = await mercadoLivreAccessToken()
    if (body.user_id && String(body.user_id) !== String(sellerId)) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const result = await syncMarketplaceSalesToZetta()
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    console.error('[mercado-livre/webhook] falha:', error)
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    topic: 'orders_v2',
    callback: '/api/integracoes/mercado-livre/webhook',
  })
}
