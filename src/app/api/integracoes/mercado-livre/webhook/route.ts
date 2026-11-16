import { NextRequest, NextResponse } from 'next/server'
import { mercadoLivreAccessToken } from '@/lib/mercado-livre'
import { runMarketplacesSync } from '@/lib/marketplace-auto-sync'

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

  if (body.topic !== 'orders_v2' || !body.user_id) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  try {
    const { sellerId } = await mercadoLivreAccessToken()
    if (String(body.user_id) !== String(sellerId)) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    // O webhook compartilha o mesmo lease do cron; nunca execute duas
    // conciliações simultâneas sobre os mesmos pedidos e anúncios.
    const result = await runMarketplacesSync()
    return NextResponse.json({ ok: result.ok, busy:result.busy, result },{status:result.ok?200:207})
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
