import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { encryptToken, ML_COOKIE, mercadoLivreConfig } from '@/lib/mercado-livre'

export const runtime = 'nodejs'

function equal(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export async function GET(req: NextRequest) {
  const pending = req.cookies.get(ML_COOKIE)?.value
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const user = await getUsuarioLogado()
  const invalid = () => NextResponse.json({ error: 'Autorização inválida ou ausente. Inicie pelo painel de Integrações.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  if (!pending || !code || !state || !user || user.role !== 'ADMIN') return invalid()

  let flow: { state: string; verifier: string; userId: string }
  try { flow = JSON.parse(pending) } catch { return invalid() }
  if (!flow.state || !flow.verifier || !equal(state, flow.state) || flow.userId !== user.id) return invalid()

  // One-time authorization: remove the browser's flow cookie even if the token exchange fails.
  const clearCookie = (response: NextResponse) => {
    response.cookies.set(ML_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/integracoes/mercado-livre', maxAge: 0 })
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  try {
    const config = mercadoLivreConfig()
    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, cache: 'no-store',
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId,
        client_secret: config.clientSecret, code, redirect_uri: config.redirectUri, code_verifier: flow.verifier }),
    })
    if (!tokenResponse.ok) throw new Error(`Troca do código falhou (${tokenResponse.status})`)
    const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; user_id?: number | string }
    if (!tokens.access_token || !tokens.refresh_token || !tokens.user_id || !Number.isFinite(Number(tokens.expires_in))) throw new Error('Resposta OAuth incompleta')

    await db.mercadoLivreConnection.upsert({ where: { id: 'matilha-prado' },
      create: { id: 'matilha-prado', sellerId: String(tokens.user_id), accessToken: encryptToken(tokens.access_token, config.key),
        refreshToken: encryptToken(tokens.refresh_token, config.key), accessTokenExpiresAt: new Date(Date.now() + Number(tokens.expires_in) * 1000) },
      update: { sellerId: String(tokens.user_id), accessToken: encryptToken(tokens.access_token, config.key),
        refreshToken: encryptToken(tokens.refresh_token, config.key), accessTokenExpiresAt: new Date(Date.now() + Number(tokens.expires_in) * 1000) },
    })
    return clearCookie(NextResponse.redirect(new URL('/?ml=connected', req.url)))
  } catch (error) {
    console.error('Mercado Livre OAuth:', error instanceof Error ? error.message : 'falha')
    return clearCookie(NextResponse.redirect(new URL('/?ml=error', req.url)))
  }
}
