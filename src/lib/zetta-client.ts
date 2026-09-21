import { integrationBridgeRequest } from '@/lib/integration-bridge'

export type ZettaAnimal = {
  id: number
  clienteId: number
  nome: string
  dataNascimento?: string | null
  microchip?: string | null
  sexo?: string | null
  peso?: number | string | null
  porte?: string | null
  especie?: string | null
  raca?: string | null
  status?: string | null
  pelagem?: string | null
  castrado?: boolean | null
  comportamento?: string | null
  filial?: number | null
  dataAtualizacao?: string | null
}

export type ZettaHistorico = {
  id: number
  animalId: number
  clienteId: number
  animalNome?: string | null
  especie?: string | null
  raca?: string | null
  datahora?: string | null
  tipo?: string | null
  status?: string | null
  peso?: number | string | null
  evento?: string | null
  descricao?: string | null
  tipoServico?: string | null
  dataAtualizacao?: string | null
  filial?: number | null
  excluido?: boolean | null
  entregue?: boolean | null
  dataEntregue?: string | null
  observacoes?: string | null
  quadroClinico?: string | null
}

type BridgePage<T> = {
  ok: boolean
  page: number
  limit: number
  total: number
  data: T[]
}

export async function getZettaAnimalsByClient(cliCod: number) {
  const result = await integrationBridgeRequest<BridgePage<ZettaAnimal>>(
    `/api/zetta/animais?cliente=${encodeURIComponent(String(cliCod))}&page=1&limit=100`
  )
  return result.data || []
}

export async function getZettaHistoriesByClient(cliCod: number) {
  const result = await integrationBridgeRequest<BridgePage<ZettaHistorico>>(
    `/api/zetta/historicos?cliente=${encodeURIComponent(String(cliCod))}&page=1&limit=100`
  )
  return result.data || []
}

export function ageLabel(dateValue?: string | null) {
  if (!dateValue) return null
  const birth = new Date(dateValue)
  if (Number.isNaN(birth.getTime())) return null

  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) years -= 1

  if (years > 0) return `${years} ano${years === 1 ? '' : 's'}`

  const months = Math.max(
    0,
    (now.getFullYear() - birth.getFullYear()) * 12 +
      now.getMonth() -
      birth.getMonth()
  )
  return `${months} mês${months === 1 ? '' : 'es'}`
}

export function normalizeHistoryStatus(history: ZettaHistorico) {
  const raw = String(history.status || '').toLowerCase()

  if (history.excluido || raw.includes('cancel')) return 'cancelado' as const
  if (
    history.entregue ||
    history.dataEntregue ||
    raw.includes('final') ||
    raw.includes('conclu') ||
    raw.includes('entreg') ||
    raw.includes('pronto')
  ) return 'finalizado' as const
  if (
    raw.includes('atend') ||
    raw.includes('andamento') ||
    raw.includes('inici')
  ) return 'em_andamento' as const
  if (raw.includes('aguard')) return 'aguardando_resposta' as const

  return 'novo' as const
}

export function historyService(history: ZettaHistorico) {
  return (
    history.tipoServico ||
    history.descricao ||
    history.evento ||
    history.tipo ||
    'Atendimento'
  )
}
