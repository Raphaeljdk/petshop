import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

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
