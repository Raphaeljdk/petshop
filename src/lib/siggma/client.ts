import { getSiggmaConfig, SiggmaConfigurationError } from '@/lib/siggma/config'
import type { SiggmaApiWarning, SiggmaTokenResponse } from '@/lib/siggma/types'

type CachedToken = {
  value: string
  expiresAt: number
}

const globalSiggma = globalThis as unknown as {
  __siggmaToken?: CachedToken
}

export class SiggmaApiError extends Error {
  constructor(message: string, public status = 502, public details?: unknown) {
    super(message)
    this.name = 'SiggmaApiError'
  }
}

function isWarning(value: unknown): value is SiggmaApiWarning {
  if (!value || typeof value !== 'object') return false
  const type = (value as { type?: unknown }).type
  return type === 'warning' || type === 'error'
}

async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const text = await response.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { return text }
  }
  return response.text()
}

async function getAccessToken(force = false): Promise<string> {
  const now = Date.now()
  const cached = globalSiggma.__siggmaToken
  if (!force && cached && cached.expiresAt > now + 30_000) return cached.value

  const { baseUrl, clientId, clientSecret, emp } = getSiggmaConfig()
  const body = new URLSearchParams({
    grant_type: 'client_credentials_emp',
    client_id: clientId,
    client_secret: clientSecret,
    emp,
  })

  const response = await fetch(`${baseUrl}/v2/oauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    cache: 'no-store',
  })

  const payload = await readResponse(response)
  if (!response.ok || !payload || typeof payload !== 'object' || !('access_token' in payload)) {
    throw new SiggmaApiError(
      response.status === 401 ? 'Credenciais Siggma recusadas.' : 'Não foi possível autenticar no Siggma.',
      response.status || 502,
      payload,
    )
  }

  const token = payload as SiggmaTokenResponse
  const expiresIn = typeof token.expires_in === 'number' && token.expires_in > 60 ? token.expires_in : 3600
  globalSiggma.__siggmaToken = {
    value: token.access_token,
    expiresAt: now + expiresIn * 1000,
  }

  return token.access_token
}

export async function testSiggmaConnection() {
  const token = await getAccessToken(true)
  return { authenticated: Boolean(token) }
}

export async function siggmaRequest<T>(
  path: string,
  init: RequestInit = {},
  retryAuth = true,
): Promise<T> {
  const { baseUrl } = getSiggmaConfig()
  const token = await getAccessToken()
  const headers = new Headers(init.headers)

  headers.set('Accept', 'application/json')
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
    cache: 'no-store',
  })

  if (response.status === 401 && retryAuth) {
    globalSiggma.__siggmaToken = undefined
    await getAccessToken(true)
    return siggmaRequest<T>(path, init, false)
  }

  const payload = await readResponse(response)

  if (!response.ok) {
    throw new SiggmaApiError(`Siggma respondeu HTTP ${response.status}.`, response.status, payload)
  }

  if (isWarning(payload)) {
    throw new SiggmaApiError(payload.msg || 'O Siggma recusou a operação.', 422, payload)
  }

  return payload as T
}

export { SiggmaConfigurationError }
