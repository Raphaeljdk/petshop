import { describe, expect, test } from 'bun:test'
import { lerPrecosPorRaca, precosPorRacaSchema } from '../src/lib/precos-por-raca'
import {
  CATALOGO_ESTETICO_MATILHA,
  configuracaoPodeSerConfirmada,
  listarServicosParaConfiguracao,
} from '../src/lib/catalogo-servicos-matilha'

describe('Catálogo estético sem valores fictícios', () => {
  test('cada serviço confirmado pela loja recebe chave única e estável', () => {
    expect(CATALOGO_ESTETICO_MATILHA.length).toBe(9)
    expect(new Set(CATALOGO_ESTETICO_MATILHA.map((s) => s.chave)).size).toBe(9)
    expect(CATALOGO_ESTETICO_MATILHA.find((s) => s.nome === 'Limpeza de ouvidos')?.chave).toBe('limpeza-de-ouvidos')
    expect(CATALOGO_ESTETICO_MATILHA.some((s) => /hospedagem/i.test(s.nome))).toBe(false)
  })

  test('retorna dados pendentes, sem inventar preço ou duração', () => {
    const items = listarServicosParaConfiguracao([])
    expect(items).toHaveLength(9)
    for (const item of items) {
      expect(item.precoCentavos).toBeNull()
      expect(item.precosPorRaca).toEqual([])
      expect(item.duracaoMinutos).toBeNull()
      expect(item.regrasPreco).toBeNull()
      expect(item.confirmado).toBe(false)
      expect(item.updatedAt).toBeNull()
    }
  })

  test('retorna só o item alterado, sem sobrescrever os demais', () => {
    const dados = listarServicosParaConfiguracao([{
      chave: 'banho', precoCentavos: 7500,
      precosPorRaca: [
        { raca: 'Golden Retriever', precoCentavos: 15000 },
        { raca: 'Poodle', precoCentavos: 9000 },
      ],
      duracaoMinutos: 60,
      regrasPreco: 'Preço varia por porte', observacoes: null,
      confirmado: true, updatedAt: '2026-11-02T00:00:00.000Z',
    }])
    expect(dados.find((s) => s.chave === 'banho')?.precoCentavos).toBe(7500)
    expect(dados.find((s) => s.chave === 'banho')?.precosPorRaca).toHaveLength(2)
    expect(dados.find((s) => s.chave === 'tosa-modalidade-a-definir')?.precosPorRaca).toEqual([])
    expect(dados.find((s) => s.chave === 'tosa-modalidade-a-definir')?.precoCentavos).toBeNull()
  })

  test('não permite confirmar sem duração e sem regra/preço', () => {
    expect(configuracaoPodeSerConfirmada({
      precoCentavos: null, duracaoMinutos: null, regrasPreco: null,
    })).toBe(false)
    expect(configuracaoPodeSerConfirmada({
      precoCentavos: null, duracaoMinutos: 60, regrasPreco: null,
    })).toBe(false)
    expect(configuracaoPodeSerConfirmada({
      precoCentavos: null, duracaoMinutos: 60, regrasPreco: '   ',
    })).toBe(false)
    expect(configuracaoPodeSerConfirmada({
      precoCentavos: 0, duracaoMinutos: 60, regrasPreco: null,
    })).toBe(true)
    expect(configuracaoPodeSerConfirmada({
      precoCentavos: null, duracaoMinutos: 45, regrasPreco: 'Preço por porte',
    })).toBe(true)
    expect(configuracaoPodeSerConfirmada({
      precoCentavos: null, duracaoMinutos: 45, regrasPreco: null,
      precosPorRaca: [{ raca: 'Golden Retriever', precoCentavos: 15000 }],
    })).toBe(true)
  })

  test('permite várias raças e valores, sem sobrescrever preço de referência', () => {
    const valores = precosPorRacaSchema.parse([
      { raca: 'Golden Retriever', precoCentavos: 15000 },
      { raca: 'Shih Tzu', precoCentavos: 9500 },
    ])
    expect(valores).toHaveLength(2)
    expect(valores[0].precoCentavos).toBe(15000)
    expect(valores[1].precoCentavos).toBe(9500)
  })

  test('recusa raça duplicada mesmo com diferença de acento, espaço ou caixa', () => {
    const validacao = precosPorRacaSchema.safeParse([
      { raca: 'Poodle', precoCentavos: 10000 },
      { raca: '  pOODLE  ', precoCentavos: 12000 },
    ])
    expect(validacao.success).toBe(false)
    if (!validacao.success) expect(validacao.error.issues[0]?.message).toContain('já está cadastrada')
  })

  test('recusa valores inválidos e não inventa preços para entradas ausentes', () => {
    expect(precosPorRacaSchema.safeParse([{ raca: 'Poodle', precoCentavos: -100 }]).success).toBe(false)
    expect(precosPorRacaSchema.safeParse([{ raca: '', precoCentavos: 10000 }]).success).toBe(false)
    expect(precosPorRacaSchema.safeParse([{ raca: 'Poodle', precoCentavos: 100.5 }]).success).toBe(false)
    expect(lerPrecosPorRaca(null)).toEqual([])
  })
})
