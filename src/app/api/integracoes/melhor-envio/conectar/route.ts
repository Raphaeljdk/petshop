import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import {
  MELHOR_ENVIO_CALLBACK,
  MELHOR_ENVIO_COOKIE,
  MELHOR_ENVIO_COOKIE_AGE,
  melhorEnvioOAuthConfig,
  randomUrlSafe,
} from '@/lib/melhor-envio'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  if (req.nextUrl.origin !== new URL(MELHOR_ENVIO_CALLBACK).origin) {
    return NextResponse.json({ error: 'Acesse o domínio de produção' }, { status: 400 })
  }

  let config: ReturnType<typeof melhorEnvioOAuthConfig>
  try {
    config = melhorEnvioOAuthConfig()
  } catch {
    return NextResponse.json(
      { error: 'Configure CLIENT_ID, CLIENT_SECRET e REDIRECT_URI do Melhor Envio' },
      { status: 503 }
    )
  }

  const state = randomUrlSafe()
  const url = new URL('/oauth/authorize', config.baseUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('scope', config.scopes)
  url.searchParams.set('state', state)

  const response = NextResponse.redirect(url)
  response.headers.set('Cache-Control', 'no-store')
  response.cookies.set(
    MELHOR_ENVIO_COOKIE,
    JSON.stringify({ state, userId: user.id }),
    {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/integracoes/melhor-envio',
      maxAge: MELHOR_ENVIO_COOKIE_AGE,
    }
  )
  return response
}
