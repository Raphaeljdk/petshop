/** Horários de agendamento online: configurados pela equipe, nunca estimados pelo portal. */
export type AgendaOnline = {
  enabled: boolean
  diasSemana: string
  abre: string
  fecha: string
  intervaloMinutos: number
}
type Agendado = { dataHora: Date; servico: string; profissionalId: string | null; petId: string; status: string }
type Bloqueado = { inicio: Date; fim: Date; profissionalId: string }

const FORMATO_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/
export const ANTECEDENCIA_MINUTOS = 15
export const HORIZONTE_DIAS = 90

export function minutosDoHorario(texto: string): number | null {
  const match = FORMATO_HORA.exec(texto)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}
export function dataLocalValida(data: string): boolean {
  return FORMATO_DATA.test(data) && !Number.isNaN(Date.parse(data + 'T12:00:00Z')) &&
    new Date(data + 'T12:00:00Z').toISOString().slice(0, 10) === data
}
export function timestampBrasilia(data: string, minutos: number): Date {
  const h = String(Math.floor(minutos / 60)).padStart(2, '0')
  const m = String(minutos % 60).padStart(2, '0')
  return new Date(`${data}T${h}:${m}:00-03:00`)
}
export function configOnlineValida(config: AgendaOnline): boolean {
  const abre = minutosDoHorario(config.abre), fecha = minutosDoHorario(config.fecha)
  const dias = config.diasSemana.split(',').filter(Boolean)
  return abre !== null && fecha !== null && fecha - abre >= 60 && fecha - abre <= 12 * 60 &&
    [15, 30, 60].includes(config.intervaloMinutos) && dias.length > 0 &&
    new Set(dias).size === dias.length && dias.every((dia) => /^[0-6]$/.test(dia))
}
export function dataReservavel(data: string, config: AgendaOnline, agora: Date = new Date()): boolean {
  if (!config.enabled || !configOnlineValida(config) || !dataLocalValida(data)) return false
  const meiaNoite = timestampBrasilia(data, 0)
  const limite = new Date(agora.getTime() + HORIZONTE_DIAS * 86400_000)
  const weekday = new Date(data + 'T12:00:00Z').getUTCDay()
  return meiaNoite.getTime() <= limite.getTime() &&
    meiaNoite.getTime() + 86400_000 >= agora.getTime() &&
    config.diasSemana.split(',').includes(String(weekday))
}
/** Retorna horários completos dentro do expediente aprovado pela equipe. */
export function gerarSlots(data: string, duracaoMinutos: number, config: AgendaOnline, agora = new Date()): Date[] {
  if (!dataReservavel(data, config, agora) || !Number.isInteger(duracaoMinutos) || duracaoMinutos < 5) return []
  const abre = minutosDoHorario(config.abre)!
  const fecha = minutosDoHorario(config.fecha)!
  const result: Date[] = []
  for (let minuto = abre; minuto + duracaoMinutos <= fecha; minuto += config.intervaloMinutos) {
    const slot = timestampBrasilia(data, minuto)
    if (slot.getTime() >= agora.getTime() + ANTECEDENCIA_MINUTOS * 60000) result.push(slot)
  }
  return result
}
function colide(a: Date, b: Date, c: Date, d: Date) {
  return a < d && c < b
}
/** Conflitos incluem horários bloqueados e atendimentos existentes, inclusive sem profissional. */
export function slotEstaLivre(
  inicio: Date,
  duracaoMinutos: number,
  profissionalId: string,
  petId: string | null,
  agendados: Agendado[],
  bloqueios: Bloqueado[],
  duracoes: Map<string, number>,
): boolean {
  const fim = new Date(inicio.getTime() + duracaoMinutos * 60000)
  if (bloqueios.some((b) => b.profissionalId === profissionalId && colide(inicio, fim, b.inicio, b.fim))) return false
  return !agendados.some((a) => {
    if (!['agendado', 'confirmado'].includes(a.status)) return false
    if (a.profissionalId && a.profissionalId !== profissionalId && a.petId !== petId) return false
    // Nunca assumir que um serviço sem duração cadastrada ocupa apenas trinta minutos.
    const fimAgendado = new Date(a.dataHora.getTime() + (duracoes.get(a.servico) ?? 720) * 60000)
    return colide(inicio, fim, a.dataHora, fimAgendado)
  })
}
