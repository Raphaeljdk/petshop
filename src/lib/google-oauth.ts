import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify as verifySignature } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { AuthError } from '@/lib/auth-http'
import { getOAuthCookieSecret } from '@/lib/auth-cookies'

export const GOOGLE_FLOW_COOKIE = 'matilha_google_flow'
export const GOOGLE_PENDING_COOKIE = 'matilha_google_pending'
export const googleCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export type GoogleIntent = 'login' | 'cadastro' | 'vincular'

type GoogleFlow = {
  intent: GoogleIntent
  state: string
  nonce: string
  verifier: string
  userId?: string
}
export type GoogleIdentity = { sub: string; email: string; nome: string }

const ISSUER = 'matilha-prado'
const FLOW_AUDIENCE = 'matilha-google-flow'
const PENDING_AUDIENCE = 'matilha-google-pending'

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || ''
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || ''
  if (!clientId || !clientSecret || !redirectUri) {
    throw new AuthError('A entrada com Google ainda não está configurada.', 503)
  }
  let url: URL
  try { url = new URL(redirectUri) }
  catch { throw new AuthError('O retorno do Google não está configurado corretamente.', 503) }
  if (
    (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') ||
    !['https:', 'http:'].includes(url.protocol) ||
    url.pathname !== '/api/auth/google/callback' ||
    url.search !== '' || url.hash !== '' || url.username !== '' || url.password !== ''
  ) {
    throw new AuthError('O retorno do Google não está configurado corretamente.', 503)
  }
  return { clientId, clientSecret, redirectUri, origin: url.origin }
}

export function createGoogleFlow(intent: GoogleIntent, userId?: string): GoogleFlow {
  return {
    intent, userId,
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    verifier: randomBytes(48).toString('base64url'),
  }
}

export function googleChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url')
}

function signed(value: object, audience: string, expiresIn: '10m' | '15m') {
  return jwt.sign(value, getOAuthCookieSecret(), {
    algorithm: 'HS256', issuer: ISSUER, audience, expiresIn,
  })
}

function verified(raw: string | undefined, audience: string): Record<string, unknown> | null {
  if (!raw || raw.length > 4096) return null
  try {
    const result = jwt.verify(raw, getOAuthCookieSecret(), {
      algorithms: ['HS256'], issuer: ISSUER, audience,
    })
    return typeof result === 'object' && result !== null ? result as Record<string, unknown> : null
  } catch { return null }
}

export function signGoogleFlow(flow: GoogleFlow) {
  return signed(flow, FLOW_AUDIENCE, '10m')
}

export function readGoogleFlow(raw: string | undefined): GoogleFlow | null {
  const result = verified(raw, FLOW_AUDIENCE)
  if (!result || !['login', 'cadastro', 'vincular'].includes(String(result.intent))) return null
  if (typeof result.state !== 'string' || typeof result.nonce !== 'string' || typeof result.verifier !== 'string') return null
  if (![result.state, result.nonce, result.verifier].every(value => /^[A-Za-z0-9_-]{30,128}$/.test(value))) return null
  if (result.intent === 'vincular' && (typeof result.userId !== 'string' || !result.userId)) return null
  return {
    intent: result.intent as GoogleIntent,
    state: result.state,
    nonce: result.nonce,
    verifier: result.verifier,
    ...(typeof result.userId === 'string' ? { userId: result.userId } : {}),
  }
}

export function safeStateMatch(expected: string, received: string | null) {
  if (!received) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function signGooglePending(identity: GoogleIdentity) {
  return signed(identity, PENDING_AUDIENCE, '15m')
}

export function readGooglePending(raw: string | undefined): GoogleIdentity | null {
  const result = verified(raw, PENDING_AUDIENCE)
  if (!result || typeof result.sub !== 'string' || typeof result.email !== 'string' || typeof result.nome !== 'string') return null
  if (result.sub.length < 1 || result.sub.length > 255 || result.nome.length < 1 || result.nome.length > 100) return null
  if (result.email.length < 3 || result.email.length > 254 || !result.email.includes('@')) return null
  return { sub: result.sub, email: result.email, nome: result.nome }
}

function decodeJsonPart(value: string): Record<string, unknown> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Token Google inválido')
  const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) throw new Error('Token Google inválido')
  return decoded as Record<string, unknown>
}

// Validação criptográfica no servidor: assinatura, emissor, público, expiração e nonce.
export async function verifyGoogleIdToken(idToken: string, clientId: string, nonce: string): Promise<GoogleIdentity> {
  const parts = idToken.split('.')
  if (parts.length !== 3 || idToken.length > 16384) throw new Error('Token Google inválido')
  const header = decodeJsonPart(parts[0])
  const claims = decodeJsonPart(parts[1])
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !/^[\w-]{1,128}$/.test(header.kid)) {
    throw new Error('Assinatura Google não reconhecida')
  }
  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
    cache: 'no-store', signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error('Certificados do Google indisponíveis')
  const keys = await response.json() as { keys?: Array<Record<string, unknown>> }
  const jwk = keys.keys?.find(key => key.kid === header.kid && key.kty === 'RSA' && key.use === 'sig')
  if (!jwk) throw new Error('Chave pública do Google não encontrada')
  const publicKey = createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' })
  const valid = verifySignature('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), publicKey, Buffer.from(parts[2], 'base64url'))
  if (!valid) throw new Error('Assinatura Google inválida')
  const now = Math.floor(Date.now() / 1000)
  if (
    !['https://accounts.google.com', 'accounts.google.com'].includes(String(claims.iss)) ||
    claims.aud !== clientId ||
    (claims.azp !== undefined && claims.azp !== clientId) ||
    typeof claims.exp !== 'number' || claims.exp <= now - 60 ||
    typeof claims.iat !== 'number' || claims.iat > now + 60 ||
    claims.nonce !== nonce || claims.email_verified !== true ||
    typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 ||
    typeof claims.email !== 'string'
  ) throw new Error('Identidade Google não verificada')
  const email = claims.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('E-mail Google inválido')
  const name = typeof claims.name === 'string' ? claims.name.trim().slice(0, 100) : ''
  return { sub: claims.sub, email, nome: name.length >= 3 ? name : 'Cliente Matilha Prado' }
}
