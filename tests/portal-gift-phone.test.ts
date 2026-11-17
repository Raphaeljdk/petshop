import { describe, expect, test } from 'bun:test'
import { normalizarTelefonePresente } from '../src/lib/portal-gift-phone'

describe('Vale-presente com telefone obrigatório', () => {
  test('aceita telefone com e sem DDI, com máscara brasileira', () => {
    expect(normalizarTelefonePresente('(11) 91594-2356')).toBe('5511915942356')
    expect(normalizarTelefonePresente('+55 (11) 91594-2356')).toBe('5511915942356')
    expect(normalizarTelefonePresente('5511915942356')).toBe('5511915942356')
    expect(normalizarTelefonePresente('(11) 3456-7890')).toBe('551134567890')
  })
  test('rejeita telefone ausente, incompleto e inválido', () => {
    expect(normalizarTelefonePresente('')).toBeNull()
    expect(normalizarTelefonePresente('99999')).toBeNull()
    expect(normalizarTelefonePresente('(00) 99999-9999')).toBeNull()
    expect(normalizarTelefonePresente('11111111111')).toBeNull()
    expect(normalizarTelefonePresente('551191594235611')).toBeNull()
  })
  test('normalização evita divergência entre números equivalentes', () => {
    expect(normalizarTelefonePresente('+55 11 91594 2356'))
      .toBe(normalizarTelefonePresente('(11) 91594-2356'))
  })
})
