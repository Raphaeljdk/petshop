import type { StatusAgendamento } from '@/lib/types'
import { siggma } from '@/lib/siggma/service'
import type { SiggmaAnimal, SiggmaAtendimento, SiggmaCliente } from '@/lib/siggma/types'

type AgendaFilters = {
  cliente?: number
  animal?: number
  colaborador?: number
  tipo?: string
  status?: string
  dataInicial?: string
  dataFinal?: string
}

const cache = {
  initialized: false,
  lastSync: null as Date | null,
  animals: new Map<number, SiggmaAnimal>(),
  clients: new Map<number, SiggmaCliente>(),
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatSince(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
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
  if (status === 'cancelado' || status === 'transferido') return 'cancelado'
  if (status === 'finalizado') return 'concluido'
  if (status === 'em andamento') return 'confirmado'
  return 'agendado'
}

export function parseSiggmaAgendaDate(value?: string | null) {
  if (!value) return null
  const raw = value.trim()
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (br) {
    const [, d, m, y, hh = '00', mm = '00', ss = '00'] = br
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}`
  }
  const iso = raw.replace(' ', 'T')
  return Number.isNaN(new Date(iso).getTime()) ? null : iso
}

async function loadAllAnimals(since?: string) {
  const first = await siggma.animais.listar({ pagina: 1, since })
  const rows = [...(first.data || [])]
  const pages = Math.max(Number(first.metadata?.paginas || 1), 1)
  for (let page = 2; page <= pages; page += 1) {
    const current = await siggma.animais.listar({ pagina: page, since })
    rows.push(...(current.data || []))
  }
  return rows
}

async function loadAllClients(since?: string) {
  const first = await siggma.clientes.listar({ pagina: 1, limit: 100, since })
  const rows = [...(first.data || [])]
  const pages = Math.max(Number(first.metadata?.paginas || 1), 1)
  for (let page = 2; page <= pages; page += 1) {
    const current = await siggma.clientes.listar({ pagina: page, limit: 100, since })
    rows.push(...(current.data || []))
  }
  return rows
}

export async function refreshAgendaLookups(force = false) {
  const now = new Date()
  if (!force && cache.initialized && cache.lastSync && now.getTime() - cache.lastSync.getTime() < 5 * 60_000) {
    return
  }

  const startedAt = new Date()
  const since = cache.initialized && cache.lastSync ? formatSince(cache.lastSync) : undefined
  const [animals, clients] = await Promise.all([loadAllAnimals(since), loadAllClients(since)])

  for (const animal of animals) cache.animals.set(animal.id, animal)
  for (const client of clients) cache.clients.set(client.cliCod, client)

  cache.initialized = true
  cache.lastSync = startedAt
}

async function loadAgenda(filters: AgendaFilters) {
  const first = await siggma.atendimentos.listar({ ...filters, pagina: 1 })
  const rows = [...(first.data || [])]
  const pages = Math.max(Number(first.metadata?.paginas || 1), 1)

  for (let page = 2; page <= pages; page += 1) {
    const current = await siggma.atendimentos.listar({ ...filters, pagina: page })
    rows.push(...(current.data || []))
  }

  return rows.filter((item) => item.excluido !== true)
}

function serviceName(item: SiggmaAtendimento) {
  const detail = item.dadosEspecificos
  const descricao = detail && typeof detail.descricao === 'string' ? detail.descricao.trim() : ''
  return item.tipoServico?.trim() || descricao || item.tipo?.trim() || 'Atendimento'
}

function clientName(clientId?: number | null) {
  if (!clientId) return 'Tutor'
  return cache.clients.get(clientId)?.pessoa?.nome?.trim() || `Cliente #${clientId}`
}

function animalName(animalId?: number | null) {
  if (!animalId) return 'Pet'
  return cache.animals.get(animalId)?.nome?.trim() || `Pet #${animalId}`
}

export async function listOfficialAgenda(filters: AgendaFilters = {}) {
  const [rows] = await Promise.all([loadAgenda(filters), refreshAgendaLookups()])

  return rows
    .map((item) => {
      const dataHora = parseSiggmaAgendaDate(item.datahora)
      const dataHoraFinal = parseSiggmaAgendaDate(item.datahoraFinal)
      const updatedAt = parseSiggmaAgendaDate(item.dataAtualizacao) || dataHora || new Date(0).toISOString()
      const petId = item.animal ? `zetta:${item.animal}` : ''
      const clienteId = item.cliente ? `zetta-client:${item.cliente}` : ''

      return {
        id: `siggma-atendimento:${item.id}`,
        siggmaId: item.id,
        petId,
        clienteId,
        servico: serviceName(item),
        dataHora: dataHora || new Date(0).toISOString(),
        dataHoraFinal,
        status: mapStatus(item.status),
        statusOriginal: item.status || 'novo',
        observacoes: item.observacoes || null,
        createdAt: dataHora || updatedAt,
        updatedAt,
        origem: 'siggma' as const,
        cancelavel: false,
        tipo: item.tipo || null,
        excluido: false,
        pet: {
          id: petId,
          nome: animalName(item.animal),
          origem: 'zetta' as const,
          zettaId: item.animal || undefined,
        },
        cliente: {
          id: clienteId,
          nome: clientName(item.cliente),
        },
      }
    })
    .filter((item) => item.dataHora !== new Date(0).toISOString())
    .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime())
}
