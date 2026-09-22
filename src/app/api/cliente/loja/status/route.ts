import { NextResponse } from 'next/server'
import { getClienteLogado } from '@/lib/auth-helpers'
import { getSiggmaConfigurationStatus } from '@/lib/siggma/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cliente = await getClienteLogado()
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })
  }

  const siggma = getSiggmaConfigurationStatus()

  return NextResponse.json({
    ok: true,
    siggmaApiConfigured: siggma.configured,
    siggmaOrderWriteConfigured: siggma.configured,
    source: 'siggma-api',
  })
}
