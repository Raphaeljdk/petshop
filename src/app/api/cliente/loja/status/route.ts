import { NextResponse } from 'next/server'
import { getClienteLogado } from '@/lib/auth-helpers'
import { integrationBridgeRequest } from '@/lib/integration-bridge'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cliente = await getClienteLogado()
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })
    }

    const status = await integrationBridgeRequest<{
      ok?: boolean
      siggmaApiConfigured?: boolean
      siggmaOrderWriteConfigured?: boolean
      zettaDatabaseConfigured?: boolean
    }>('/api/status')

    return NextResponse.json({
      ok: true,
      zettaDatabaseConfigured: Boolean(status.zettaDatabaseConfigured),
      siggmaApiConfigured: Boolean(status.siggmaApiConfigured),
      siggmaOrderWriteConfigured: Boolean(status.siggmaOrderWriteConfigured),
    })
  } catch (error) {
    console.error('[cliente/loja/status] erro:', error)
    return NextResponse.json(
      {
        ok: false,
        zettaDatabaseConfigured: false,
        siggmaApiConfigured: false,
        siggmaOrderWriteConfigured: false,
      },
      { status: 503 }
    )
  }
}
