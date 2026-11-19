import { NextRequest, NextResponse } from 'next/server'
import { authReady } from '@/lib/auth-http'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import {
  GOOGLE_FLOW_COOKIE, GOOGLE_PENDING_COOKIE, createGoogleFlow, googleChallenge,
  googleConfig, googleCookieOptions, signGoogleFlow, type GoogleIntent,
} from '@/lib/google-oauth'

export async function GET(req: NextRequest) {
  try {
    authReady()
    const config = googleConfig()
    const requested = req.nextUrl.searchParams.get('intent')
    const intent: GoogleIntent = requested === 'cadastro' ? 'cadastro' : requested === 'vincular' ? 'vincular' : 'login'
    // O cookie de sessão é host-only. O fluxo roda sempre no domínio canônico.
    if (req.nextUrl.origin !== config.origin) {
      const canonical = new URL('/api/auth/google', config.origin)
      canonical.searchParams.set('intent', intent)
      return NextResponse.redirect(canonical)
    }
    let userId: string | undefined
    if (intent === 'vincular') {
      const user = await getUsuarioLogado()
      if (!user || user.role !== 'CLIENTE') {
        return NextResponse.redirect(new URL('/login?authError=google-login-required', config.origin))
      }
      userId = user.id
    }

    const flow = createGoogleFlow(intent, userId)
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', config.clientId)
    url.searchParams.set('redirect_uri', config.redirectUri)
    url.searchParams.set('scope', 'openid email profile')
    url.searchParams.set('state', flow.state)
    url.searchParams.set('nonce', flow.nonce)
    url.searchParams.set('code_challenge', googleChallenge(flow.verifier))
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('prompt', 'select_account')

    const response = NextResponse.redirect(url, { status: 302 })
    response.cookies.set(GOOGLE_FLOW_COOKIE, signGoogleFlow(flow), { ...googleCookieOptions, maxAge: 600 })
    response.cookies.set(GOOGLE_PENDING_COOKIE, '', { ...googleCookieOptions, maxAge: 0 })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch {
    return NextResponse.redirect(new URL('/login?authError=google-unavailable', req.nextUrl.origin))
  }
}
