import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'

export const ML_CALLBACK = 'https://www.matilhaprado.com.br/api/integracoes/mercado-livre/callback'
export const ML_COOKIE = 'ml_oauth_pending'
export const ML_COOKIE_AGE = 600

export function mercadoLivreConfig() {
  const clientId = process.env.MERCADO_LIVRE_CLIENT_ID?.trim()
  const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET?.trim()
  const redirectUri = process.env.MERCADO_LIVRE_REDIRECT_URI?.trim() || ML_CALLBACK
  const key = process.env.MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY?.trim()
  if (!clientId || !clientSecret || redirectUri !== ML_CALLBACK || !key || !/^[a-f\d]{64}$/i.test(key)) {
    throw new Error('Configuração do Mercado Livre incompleta ou redirect URI divergente')
  }
  return { clientId, clientSecret, redirectUri, key: Buffer.from(key, 'hex') }
}

export function randomUrlSafe(bytes = 32) { return randomBytes(bytes).toString('base64url') }
export function pkceChallenge(verifier: string) { return createHash('sha256').update(verifier).digest('base64url') }

export function encryptToken(value: string, key: Buffer) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map(part => part.toString('base64url')).join('.')
}

export function decryptToken(value: string, key: Buffer) {
  const [iv, tag, data] = value.split('.')
  if (!iv || !tag || !data) throw new Error('Token criptografado inválido')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}

export async function mercadoLivreAccessToken() {
  const config = mercadoLivreConfig()
  const connection = await db.mercadoLivreConnection.findUnique({ where: { id: 'matilha-prado' } })
  if (!connection) throw new Error('Conta Mercado Livre não conectada')
  if (connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000) {
    return { token: decryptToken(connection.accessToken, config.key), sellerId: connection.sellerId }
  }

  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: config.clientId,
      client_secret: config.clientSecret, refresh_token: decryptToken(connection.refreshToken, config.key) }),
  })
  if (!response.ok) {
    // A refresh token may have been consumed by a concurrent request.
    const latest = await db.mercadoLivreConnection.findUnique({ where: { id: connection.id } })
    if (latest && latest.refreshToken !== connection.refreshToken && latest.accessTokenExpiresAt > new Date(Date.now() + 60_000)) {
      return { token: decryptToken(latest.accessToken, config.key), sellerId: latest.sellerId }
    }
    throw new Error(`Renovação do Mercado Livre falhou (${response.status}); reconecte a conta`)
  }
  const payload = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number }
  if (!payload.access_token || !payload.refresh_token || !Number.isFinite(Number(payload.expires_in))) {
    throw new Error('Resposta de renovação incompleta')
  }
  const updated = await db.mercadoLivreConnection.updateMany({
    where: { id: connection.id, refreshToken: connection.refreshToken },
    data: { accessToken: encryptToken(payload.access_token, config.key), refreshToken: encryptToken(payload.refresh_token, config.key),
      accessTokenExpiresAt: new Date(Date.now() + Number(payload.expires_in) * 1000) },
  })
  if (!updated.count) {
    const latest = await db.mercadoLivreConnection.findUniqueOrThrow({ where: { id: connection.id } })
    return { token: decryptToken(latest.accessToken, config.key), sellerId: latest.sellerId }
  }
  return { token: payload.access_token, sellerId: connection.sellerId }
}
