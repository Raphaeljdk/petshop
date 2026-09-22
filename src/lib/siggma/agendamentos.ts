import type { StatusAgendamento } from '@/lib/types'
import type { SiggmaAgendaItem } from '@/lib/siggma/types'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number.parseInt(value, 10)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function normalizeStatus(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function mapStatus(value: unknown): StatusAgendamento {
  const status = normalizeStatus(value)
  if (status.includes('cancel') || status.includes('transfer')) return 'cancelado'
  if (status.includes('final') || status.includes('conclu')) return 'concluido'
  if (status.includes('andamento') || status.includes('atend')) return 'confirmado'
  return 'agendado'
}

function normalizeDateTime(value: unknown, datePart?: unknown, timePart?: unknown) {
  const direct = firstString(value)
  if (direct) {
    const normalized = direct.replace(' ', 'T')
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) return `${normalized}:00`
    return normalized
  }
  const date = firstString(datePart)
  const time = firstString(timePart)
  if (date && time) {
    const cleanTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time
    return `${date}T${cleanTime}`
  }
  return new Date(0).toISOString()
}

export function getSiggmaAgendaItemId(item: SiggmaAgendaItem) {
  return firstNumber(item.id, item.agendamentoId, item.agendamento_id, item.codigo, asRecord(item.agendamento)?.id)
}

export function normalizeSiggmaAgendaItem(item: SiggmaAgendaItem, localClientId: string) {
  const animal = asRecord(item.animal)
  const pet = asRecord(item.pet)
  const cliente = asRecord(item.cliente)
  const servico = asRecord(item.servico)
  const tipoServico = asRecord(item.tipoServico)
  const id = getSiggmaAgendaItemId(item)
  const animalId = firstNumber(item.animalId, item.animal_id, item.petId, item.pet_id, animal?.id, pet?.id)
  const animalNome = firstString(item.animalNome, item.petNome, animal?.nome, pet?.nome, typeof item.animal === 'string' ? item.animal : null, typeof item.pet === 'string' ? item.pet : null) || 'Pet'
  const rawStatus = firstString(item.status, asRecord(item.status)?.nome, asRecord(item.status)?.descricao) || 'novo'
  const dataHora = normalizeDateTime(item.quando ?? item.dataHora ?? item.datahora ?? item.data_hora, item.data, item.hora)
  const servicoNome = firstString(item.servicoNome, item.tipoServicoNome, item.tipo_servico, item.tipo, servico?.tipo, servico?.nome, servico?.descricao, tipoServico?.tipo, tipoServico?.nome, tipoServico?.descricao, typeof item.servico === 'string' ? item.servico : null, typeof item.tipoServico === 'string' ? item.tipoServico : null) || 'Serviço'
  const createdAt = firstString(item.createdAt, item.criadoEm, item.dataCriacao) || dataHora
  const updatedAt = firstString(item.updatedAt, item.atualizadoEm, item.dataAtualizacao) || createdAt

  return {
    id: id ? `siggma:${id}` : `siggma:${animalId || 'pet'}:${dataHora}`,
    siggmaId: id,
    petId: animalId ? `zetta:${animalId}` : '',
    clienteId: localClientId,
    servico: servicoNome,
    dataHora,
    status: mapStatus(rawStatus),
    statusOriginal: rawStatus,
    observacoes: firstString(item.observacoes, item.observacao),
    createdAt,
    updatedAt,
    origem: 'siggma' as const,
    cancelavel: id !== null && normalizeStatus(rawStatus) === 'novo',
    pet: animalId ? { id: `zetta:${animalId}`, nome: animalNome } : undefined,
    siggmaClienteId: firstNumber(item.clienteId, item.cliente_id, cliente?.id, cliente?.cliCod, cliente?.cli_cod),
  }
}

export function parseZettaPetId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.trunc(value)
  if (typeof value !== 'string') return null
  const raw = value.startsWith('zetta:') ? value.slice('zetta:'.length) : value
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function formatSiggmaQuando(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace('T', ' ')
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(normalized)) return null
  return normalized.length === 16 ? `${normalized}:00` : normalized
}
