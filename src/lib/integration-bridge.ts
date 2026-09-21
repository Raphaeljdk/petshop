import 'server-only'

export class IntegrationBridgeConfigurationError extends Error {
  constructor(public missing: string[]) {
    super(`Configuração da bridge incompleta: ${missing.join(', ')}`)
    this.name = 'IntegrationBridgeConfigurationError'
  }
}

export function getIntegrationBridgeStatus() {
  const url = process.env.INTEGRATION_BRIDGE_URL?.trim() || ''
  const secret = process.env.INTEGRATION_BRIDGE_SECRET?.trim() || ''
  const missing: string[] = []

  if (!url) missing.push('INTEGRATION_BRIDGE_URL')
  if (!secret) missing.push('INTEGRATION_BRIDGE_SECRET')

  let protocol: string | null = null
  let hostname: string | null = null

  if (url) {
    try {
      const parsed = new URL(url)
      protocol = parsed.protocol
      hostname = parsed.hostname
    } catch {
      missing.push('INTEGRATION_BRIDGE_URL_INVALID')
    }
  }

  return {
    configured: missing.length === 0,
    missing,
    urlConfigured: Boolean(url),
    secretConfigured: Boolean(secret),
    protocol,
    hostname,
  } as const
}

function getConfig() {
  const status = getIntegrationBridgeStatus()
  if (!status.configured) {
    throw new IntegrationBridgeConfigurationError([...status.missing])
  }

  const url = process.env.INTEGRATION_BRIDGE_URL!.trim().replace(/\/+$/, '')
  const secret = process.env.INTEGRATION_BRIDGE_SECRET!.trim()

  if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) {
    throw new IntegrationBridgeConfigurationError([
      'INTEGRATION_BRIDGE_URL_HTTPS_REQUIRED',
    ])
  }

  return { url, secret }
}

export async function integrationBridgeRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const { url, secret } = getConfig()
  const headers = new Headers(init.headers)

  headers.set('Accept', 'application/json')
  headers.set('Authorization', `Bearer ${secret}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(
    `${url}${path.startsWith('/') ? path : `/${path}`}`,
    {
      ...init,
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    }
  )

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: unknown }).error || 'Bridge indisponível')
        : `Bridge respondeu HTTP ${response.status}`

    throw new Error(message)
  }

  return payload as T
}

export async function testIntegrationBridge() {
  const result = await integrationBridgeRequest<{
    ok?: boolean
    bridge?: string
    siggmaApiConfigured?: boolean
    zettaDatabaseConfigured?: boolean
  }>('/api/status')

  return {
    reachable: result.ok === true,
    bridge: result.bridge || null,
    siggmaApiConfigured: Boolean(result.siggmaApiConfigured),
    zettaDatabaseConfigured: Boolean(result.zettaDatabaseConfigured),
  }
}
