import { authFailure, authJson, AuthError, authReady } from '@/lib/auth-http'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { syncZettaProductsToLocal } from '@/lib/zetta-products'

async function requireAdmin() {
  authReady()
  const user = await getUsuarioLogado()
  if (!user) throw new AuthError('Entre na sua conta para continuar.', 401)
  if (user.role !== 'ADMIN') {
    throw new AuthError('Acesso permitido apenas à administração.', 403)
  }
}

export async function POST() {
  try {
    await requireAdmin()
    const result = await syncZettaProductsToLocal()

    return authJson({
      success: true,
      source: 'siggma-api',
      totalZetta: result.total,
      categorias: result.categories,
      sincronizados: result.products.length,
    })
  } catch (error) {
    return authFailure(error)
  }
}
