import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { ML_CALLBACK, ML_COOKIE, ML_COOKIE_AGE, mercadoLivreConfig, pkceChallenge, randomUrlSafe } from '@/lib/mercado-livre'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  if (req.nextUrl.origin !== new URL(ML_CALLBACK).origin) return NextResponse.json({ error: 'Acesse o domínio de produção' }, { status: 400 })

  let config: ReturnType<typeof mercadoLivreConfig>
  try { config = mercadoLivreConfig() }
  catch { return NextResponse.json({ error: 'Configure as credenciais e a chave de criptografia do Mercado Livre' }, { status: 503 }) }

  const state = randomUrlSafe()
  const verifier = randomUrlSafe(48)
  const url = new URL('https://auth.mercadolivre.com.br/authorization')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', pkceChallenge(verifier))
  url.searchParams.set('code_challenge_method', 'S256')

  const response = NextResponse.redirect(url)
  response.headers.set('Cache-Control', 'no-store')
  response.cookies.set(ML_COOKIE, JSON.stringify({ state, verifier, userId: user.id }), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/api/integracoes/mercado-livre', maxAge: ML_COOKIE_AGE,
  })
  return response
}
