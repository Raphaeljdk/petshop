import { getUsuarioLogado } from '@/lib/auth-cookies'
import { AuthError, authFailure, authJson, authReady } from '@/lib/auth-http'
import {
  getIntegrationBridgeStatus,
  IntegrationBridgeConfigurationError,
  testIntegrationBridge,
} from '@/lib/integration-bridge'

async function requireAdmin() {
  authReady()
  const user = await getUsuarioLogado()
  if (!user) throw new AuthError('Entre na sua conta para continuar.', 401)
  if (user.role !== 'ADMIN') {
    throw new AuthError('Acesso permitido apenas à administração.', 403)
  }
}

export async function GET() {
  try {
    await requireAdmin()

    const config = getIntegrationBridgeStatus()
    if (!config.configured) {
      return authJson({
        success: true,
        bridge: {
          ...config,
          reachable: false,
        },
      })
    }

    const connection = await testIntegrationBridge()
    return authJson({
      success: true,
      bridge: {
        ...config,
        ...connection,
      },
    })
  } catch (error) {
    if (error instanceof IntegrationBridgeConfigurationError) {
      return authJson({
        success: true,
        bridge: {
          configured: false,
          missing: error.missing,
          reachable: false,
        },
      })
    }

    return authFailure(error)
  }
}
