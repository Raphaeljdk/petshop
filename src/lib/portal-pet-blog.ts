/**
 * Diários só são exibidos no blog após aceite individual e aprovação da equipe.
 * Dados privados (peso, vacinação, tutor, documentos, contatos) nunca entram na projeção.
 */
export type DiarioBlog = {
  id: string
  kind: string
  title: string
  notes: string | null
  imageData: string | null
  createdAt: Date
  eventAt: Date
  createdByAdmin: boolean
  blogConsentAt: Date | null
  blogStatus: string
}

export const HISTORIAS_PETS_CATEGORIA = 'Histórias dos pets'

export function podeExibirDiarioNoBlog(item: Pick<DiarioBlog, 'kind'|'blogStatus'|'blogConsentAt'|'createdByAdmin'>): boolean {
  return item.kind === 'diario' && item.blogStatus === 'publicado' &&
    item.blogConsentAt !== null && !item.createdByAdmin
}

export function artigoDeDiario(item: DiarioBlog) {
  if (!podeExibirDiarioNoBlog(item)) return null
  const texto = item.notes?.trim() || 'Um momento especial compartilhado com a Matilha Prado.'
  return {
    id: 'historia-pet:' + item.id,
    title: item.title,
    category: HISTORIAS_PETS_CATEGORIA,
    summary: texto.slice(0, 320),
    body: texto,
    imageUrl: item.imageData,
    productId: null,
    createdAt: item.createdAt,
    isPetStory: true,
  }
}
