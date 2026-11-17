import { describe, expect, test } from 'bun:test'
import { horarioBloqueado, intervalosSobrepostos } from '../src/lib/agenda-bloqueios-policy'

describe('bloqueio de agenda individual', () => {
  const inicio = new Date('2026-11-18T12:00:00-03:00')
  const fim = new Date('2026-11-18T13:00:00-03:00')
  test('bloqueia início e período interno, mas libera instante final', () => {
    expect(horarioBloqueado(inicio, inicio, fim)).toBe(true)
    expect(horarioBloqueado(new Date('2026-11-18T12:30:00-03:00'), inicio, fim)).toBe(true)
    expect(horarioBloqueado(fim, inicio, fim)).toBe(false)
  })
  test('períodos contíguos não colidem, mas sobreposição parcial colide', () => {
    expect(intervalosSobrepostos(inicio, fim, fim, new Date('2026-11-18T14:00:00-03:00'))).toBe(false)
    expect(intervalosSobrepostos(inicio, fim, new Date('2026-11-18T12:30:00-03:00'), new Date('2026-11-18T14:00:00-03:00'))).toBe(true)
  })
})
