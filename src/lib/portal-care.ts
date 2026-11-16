import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado, type UsuarioLogado } from '@/lib/auth-cookies'
import { getZettaAnimalsByClient } from '@/lib/zetta-client'
import { AuthError } from '@/lib/auth-http'

export async function portalCliente(): Promise<{ user: UsuarioLogado; clienteId: string }> {
  const user = await getUsuarioLogado()
  if (!user?.cliente?.id || user.role !== 'CLIENTE')
    throw new AuthError('Entre com uma conta de cliente para acessar este recurso.', 401)
  return { user, clienteId: user.cliente.id }
}

export async function ownsPet(user: UsuarioLogado, petKey: string): Promise<boolean> {
  if (!user.clienteId || !petKey || petKey.length > 100) return false
  const local = await db.pet.findFirst({
    where: { id: petKey, clienteId: user.clienteId, ativo: true },
    select: { id: true },
  })
  if (local) return true
  if (!user.siggmaCliCod || !/^zetta:[0-9]+$/.test(petKey)) return false
  const linked = await getZettaAnimalsByClient(user.siggmaCliCod)
  return linked.some((p) => 'zetta:' + p.id === petKey)
}

export function cleanEmail(value: string) { return value.trim().toLocaleLowerCase('pt-BR') }
export const petKeySchema = z.string().trim().min(1).max(100)
export const portalBool = z.boolean()
export const portalDate = z.string().datetime({ offset: true }).nullable().optional()
export const bodyText = z.string().trim().max(2000).nullable().optional()

export { imageData, recommendationRank } from './portal-care-rules'
