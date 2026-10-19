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

/**
 * Integração encerrada: a aplicação não acessa mais a bridge Zetta.
 * Mantemos a assinatura para impedir acessos acidentais do código legado.
 */
export async function integrationBridgeRequest<T>(
  _path: string,
  _init: RequestInit = {}
): Promise<T> {
  throw new Error('A integração Zetta/Siggma foi desativada no ERP Matilha Prado.')
}

export async function testIntegrationBridge() {
  return {
    reachable: false,
    bridge: null,
    siggmaApiConfigured: false,
    siggmaOrderWriteConfigured: false,
    zettaDatabaseConfigured: false,
  }
}
