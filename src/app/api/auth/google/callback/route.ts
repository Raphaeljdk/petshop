import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { COOKIE_NAME, criarToken, getUsuarioLogado } from '@/lib/auth-cookies'
import { authReady } from '@/lib/auth-http'
import {
  GOOGLE_FLOW_COOKIE, GOOGLE_PENDING_COOKIE, googleConfig, googleCookieOptions,
  readGoogleFlow, safeStateMatch, signGooglePending, verifyGoogleIdToken,
} from '@/lib/google-oauth'

function cleared(req: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, req.nextUrl.origin), { status: 302 })
  response.cookies.set(GOOGLE_FLOW_COOKIE, '', { ...googleCookieOptions, maxAge: 0 })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

function failed(req: NextRequest, code: string) {
  const flow = readGoogleFlow(req.cookies.get(GOOGLE_FLOW_COOKIE)?.value)
  const destination = flow?.intent === 'vincular' ? '/?googleError=' : '/login?authError='
  return cleared(req, destination + encodeURIComponent(code))
}

export async function GET(req: NextRequest) {
  const flow = readGoogleFlow(req.cookies.get(GOOGLE_FLOW_COOKIE)?.value)
  if (!flow || !safeStateMatch(flow.state, req.nextUrl.searchParams.get('state'))) {
    return failed(req, 'google-session-expired')
  }
  if (req.nextUrl.searchParams.has('error')) {
    return failed(req, 'google-cancelled')
  }
  const code = req.nextUrl.searchParams.get('code')
  if (!code || code.length > 4096) return failed(req, 'google-invalid')

  try {
    authReady()
    const config = googleConfig()
    if (config.origin !== req.nextUrl.origin) return failed(req, 'google-invalid')
    const tokensResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: config.clientId, client_secret: config.clientSecret,
        redirect_uri: config.redirectUri, grant_type: 'authorization_code',
        code_verifier: flow.verifier,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!tokensResponse.ok) return failed(req, 'google-invalid')
    const tokens = await tokensResponse.json() as { id_token?: unknown }
    if (typeof tokens.id_token !== 'string') return failed(req, 'google-invalid')
    const identity = await verifyGoogleIdToken(tokens.id_token, config.clientId, flow.nonce)

    if (flow.intent === 'vincular') {
      const current = await getUsuarioLogado()
      if (!current || current.role !== 'CLIENTE' || current.id !== flow.userId) {
        return failed(req, 'google-login-required')
      }
      if (current.email.toLowerCase() !== identity.email) {
        return failed(req, 'google-email-different')
      }
      const owner = await db.user.findUnique({ where: { googleSub: identity.sub }, select: { id: true } })
      if (owner && owner.id !== current.id) return failed(req, 'google-already-linked')
      const updated = await db.user.updateMany({
        where: {
          id: current.id, role: 'CLIENTE', ativo: true,
          email: { equals: identity.email, mode: 'insensitive' },
          OR: [{ googleSub: null }, { googleSub: identity.sub }],
        },
        data: { googleSub: identity.sub },
      })
      if (updated.count !== 1) return failed(req, 'google-already-linked')
      return cleared(req, '/?google=connected')
    }

    const user = await db.user.findUnique({
      where: { googleSub: identity.sub },
      select: { id: true, nome: true, email: true, role: true, clienteId: true, ativo: true },
    })
    if (user) {
      if (!user.ativo || user.role !== 'CLIENTE') return failed(req, 'google-unavailable')
      const response = cleared(req, '/')
      const token = await criarToken(user, true)
      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
      })
      return response
    }

    // Um e-mail Google verificado não autoriza reivindicar um prontuário existente.
    const existing = await db.user.findFirst({
      where: { email: { equals: identity.email, mode: 'insensitive' } },
      select: { id: true },
    })
    const client = await db.cliente.findFirst({
      where: { email: { equals: identity.email, mode: 'insensitive' } },
      select: { id: true },
    })
    if (existing || client) return failed(req, 'google-existing-account')

    const response = cleared(req, '/cadastro/google')
    response.cookies.set(GOOGLE_PENDING_COOKIE, signGooglePending(identity), {
      ...googleCookieOptions, maxAge: 900,
    })
    return response
  } catch {
    return failed(req, 'google-unavailable')
  }
}
