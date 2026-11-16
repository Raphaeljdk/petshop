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
export const imageData = z.string().max(220000).regex(
  /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/,
  'A imagem deve ser JPEG, PNG ou WebP com até 160 KB.',
).nullable().optional()
export const petKeySchema = z.string().trim().min(1).max(100)
export const portalBool = z.boolean()
export const portalDate = z.string().datetime({ offset: true }).nullable().optional()
export const bodyText = z.string().trim().max(2000).nullable().optional()

export function recommendationRank(nome: string, categoria: string, especie: string, porte: string, idadeAnos: number | null = null) {
  const text = (nome + ' ' + categoria).toLocaleLowerCase('pt-BR')
  const pet = especie.toLocaleLowerCase('pt-BR')
  let score = 0
  if (pet.includes('gat') && /(gato|felino|cat)/.test(text)) score += 5
  if ((pet.includes('cach') || pet.includes('canin')) && /(c[aã]o|canino|dog)/.test(text)) score += 5
  if (porte && text.includes(porte.toLocaleLowerCase('pt-BR'))) score += 2
  if (idadeAnos != null && idadeAnos < 1 && /(filhote|puppy|junior)/.test(text)) score += 3
  if (idadeAnos != null && idadeAnos >= 8 && /(s[eê]nior|senior|idoso)/.test(text)) score += 3
  if (/(brinquedo|mordedor|petisco|acess[oó]rio)/.test(text)) score += 1
  if (/(ra[cç][aã]o|medicamento|tratamento cl[ií]nico)/.test(text)) score -= 10
  return score
}
