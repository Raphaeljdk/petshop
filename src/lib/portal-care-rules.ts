import { z } from 'zod'

export const imageData = z.string().max(220000).regex(
  /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/,
  'A imagem deve ser JPEG, PNG ou WebP com até 160 KB.',
).nullable().optional()

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
