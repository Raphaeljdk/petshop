import { describe, expect, test } from 'bun:test'
import {
  configOnlineValida, dataReservavel, gerarSlots, slotEstaLivre, timestampBrasilia,
} from '../src/lib/agenda-online'

const config = {
  enabled: true, diasSemana: '1,2,3,4,5,6', abre: '09:00', fecha: '18:00', intervaloMinutos: 30,
}
const agora = new Date('2026-11-19T12:00:00.000Z')
const reservas = [{ dataHora: new Date('2026-11-20T12:00:00.000Z'),
  servico: 'Banho', profissionalId: 'p1', petId: 'pet1', status: 'agendado' }]
const duracoes = new Map([['Banho', 120]])

describe('Agenda online da Matilha Prado', () => {
  test('não oferece slots sem dias/horários explicitamente configurados', () => {
    const semConfig = { enabled: false, diasSemana: '', abre: '', fecha: '', intervaloMinutos: 30 }
    expect(configOnlineValida(semConfig)).toBe(false)
    expect(gerarSlots('2026-11-20', 120, semConfig, agora)).toEqual([])
  })
  test('não cria horários fora do expediente e respeita duração real', () => {
    const slots = gerarSlots('2026-11-20', 120, config, agora)
    expect(slots[0].toISOString()).toBe('2026-11-20T12:00:00.000Z')
    expect(slots.at(-1)?.toISOString()).toBe('2026-11-20T19:00:00.000Z')
    expect(slots).toHaveLength(15)
  })
  test('filtra dias não configurados, datas inválidas e datas além do horizonte', () => {
    expect(dataReservavel('2026-11-22', config, agora)).toBe(false)
    expect(dataReservavel('2026-11-31', config, agora)).toBe(false)
    expect(dataReservavel('2027-07-01', config, agora)).toBe(false)
    expect(dataReservavel('2026-11-20', config, agora)).toBe(true)
  })
  test('impede sobreposição de atendimentos, bloqueios e agendamentos do mesmo pet', () => {
    const inicio = timestampBrasilia('2026-11-20', 10 * 60)
    expect(slotEstaLivre(inicio, 120, 'p1', 'pet2', reservas, [], duracoes)).toBe(false)
    expect(slotEstaLivre(inicio, 120, 'p2', 'pet1', reservas, [], duracoes)).toBe(false)
    expect(slotEstaLivre(inicio, 120, 'p2', 'pet2', reservas, [], duracoes)).toBe(true)
    expect(slotEstaLivre(inicio, 120, 'p2', 'pet2', [], [{
      profissionalId: 'p2', inicio: new Date('2026-11-20T12:30:00.000Z'),
      fim: new Date('2026-11-20T13:30:00.000Z'),
    }], duracoes)).toBe(false)
  })
  test('não considera cancelados como conflito nem assume duração curta quando ela é desconhecida', () => {
    const inicio = timestampBrasilia('2026-11-20', 14 * 60)
    expect(slotEstaLivre(inicio, 60, 'p1', 'pet2',
      [{ ...reservas[0], status: 'cancelado' }], [], duracoes)).toBe(true)
    expect(slotEstaLivre(inicio, 60, 'p1', 'pet2',
      [{ ...reservas[0], servico: 'Antigo serviço sem duração' }], [], duracoes)).toBe(false)
  })
  test('bloqueia reservas simultâneas de profissionais não atribuídos', () => {
    const inicio = timestampBrasilia('2026-11-20', 10 * 60)
    expect(slotEstaLivre(inicio, 60, 'p2', null,
      [{ ...reservas[0], profissionalId: null }], [], duracoes)).toBe(false)
  })
})
