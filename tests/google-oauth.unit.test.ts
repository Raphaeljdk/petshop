/// <reference types="bun-types" />
import { expect, test } from 'bun:test'
import { generateKeyPairSync, sign } from 'node:crypto'
import {
  createGoogleFlow, googleChallenge, readGoogleFlow, readGooglePending,
  safeStateMatch, signGoogleFlow, signGooglePending, verifyGoogleIdToken,
} from '../src/lib/google-oauth'

test('state, PKCE e nonce são aleatórios e o cookie de fluxo é assinado e expira', () => {
  const one = createGoogleFlow('login')
  const two = createGoogleFlow('login')
  expect(one.state).not.toBe(two.state)
  expect(one.nonce).not.toBe(two.nonce)
  expect(one.verifier).not.toBe(two.verifier)
  expect(googleChallenge(one.verifier)).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(safeStateMatch(one.state, one.state)).toBe(true)
  expect(safeStateMatch(one.state, two.state)).toBe(false)
  expect(safeStateMatch(one.state, 'other')).toBe(false)
  expect(readGoogleFlow(signGoogleFlow(one))).toEqual(one)
  expect(readGoogleFlow(signGoogleFlow(one) + 'wrong')).toBeNull()
  expect(readGoogleFlow(undefined)).toBeNull()
})

test('cadastro pendente só pode recuperar identidade assinada no servidor', () => {
  const profile = { sub: 'google-sub-123', nome: 'Cliente Google', email: 'cliente@example.com' }
  const cookie = signGooglePending(profile)
  expect(readGooglePending(cookie)).toEqual(profile)
  expect(readGooglePending(cookie + 'tampered')).toBeNull()
})

test('ID token Google exige assinatura válida, audience correto e nonce correto', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = publicKey.export({ format: 'jwk' })
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    expect(String(url)).toBe('https://www.googleapis.com/oauth2/v3/certs')
    return new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'test-key', kty: 'RSA', use: 'sig' }] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
  function signedToken(overrides: Record<string, unknown> = {}) {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://accounts.google.com',
      aud: 'google-client-id',
      nonce: 'correct-nonce',
      sub: 'stable-google-sub',
      email: 'Cliente@example.com',
      email_verified: true,
      name: 'Cliente Google',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      ...overrides,
    })).toString('base64url')
    const signature = sign('RSA-SHA256', Buffer.from(header + '.' + payload), privateKey).toString('base64url')
    return header + '.' + payload + '.' + signature
  }
  try {
    expect(await verifyGoogleIdToken(signedToken(), 'google-client-id', 'correct-nonce')).toEqual({
      sub: 'stable-google-sub', email: 'cliente@example.com', nome: 'Cliente Google',
    })
    await expect(verifyGoogleIdToken(signedToken(), 'wrong-audience', 'correct-nonce')).rejects.toThrow()
    await expect(verifyGoogleIdToken(signedToken(), 'google-client-id', 'bad-nonce')).rejects.toThrow()
    await expect(verifyGoogleIdToken(signedToken({ email_verified: false }), 'google-client-id', 'correct-nonce')).rejects.toThrow()
    const modified = signedToken().slice(0, -3) + 'AAA'
    await expect(verifyGoogleIdToken(modified, 'google-client-id', 'correct-nonce')).rejects.toThrow()
  } finally {
    globalThis.fetch = originalFetch
  }
})
