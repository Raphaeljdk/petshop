import { getUsuarioLogado } from '@/lib/auth-cookies'
import { AuthError, authFailure, authJson, authReady } from '@/lib/auth-http'
import { getSiggmaConfigurationStatus } from '@/lib/siggma/config'
import { testSiggmaConnection } from '@/lib/siggma/client'

async function requireAdmin() {
  authReady()
  const user = await getUsuarioLogado()
  if (!user) throw new AuthError('Entre na sua conta para continuar.', 401)
  if (user.role !== 'ADMIN') throw new AuthError('Acesso permitido apenas à administração.', 403)
}

export async function GET() {
  try {
    await requireAdmin()
    const config = getSiggmaConfigurationStatus()

    if (!config.configured) {
      return authJson({
        success: true,
        siggma: {
          ...config,
          authenticated: false,
        },
      })
    }

    const connection = await testSiggmaConnection()
    return authJson({
      success: true,
      siggma: {
        ...config,
        ...connection,
      },
    })
  } catch (error) {
    return authFailure(error)
  }
}
