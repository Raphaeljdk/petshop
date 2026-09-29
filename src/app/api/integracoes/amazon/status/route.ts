import { NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import {
  AmazonSpApiError,
  amazonSellerListings,
  amazonSpApiConfigState,
} from '@/lib/amazon-sp-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const state = amazonSpApiConfigState()
  if (!state.configured) {
    return NextResponse.json(
      {
        ...state,
        connected: false,
        catalogAccess: false,
        error:
          state.missing.length > 0
            ? `Faltam variáveis: ${state.missing.join(', ')}`
            : 'Endpoint Amazon inválido.',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  try {
    await amazonSellerListings(1)
    return NextResponse.json(
      {
        ...state,
        connected: true,
        catalogAccess: true,
        error: null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    const known =
      error instanceof AmazonSpApiError
        ? error
        : new AmazonSpApiError(
            'unknown',
            'Não foi possível validar a integração Amazon.',
            502
          )

    return NextResponse.json(
      {
        ...state,
        connected: false,
        catalogAccess: false,
        error: known.message,
        errorCode: known.code,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
