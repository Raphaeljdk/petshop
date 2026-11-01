import { describe, expect, test } from 'bun:test'
import { CATEGORIAS_AGENDA, SERVICOS_ESTETICOS_MATILHA, SUGESTOES_AGENDA, inferirCategoriaAgenda } from '../src/lib/agenda-servicos'

describe('Matilha Prado: catálogo estético confirmado', () => {
  test('serviços confirmados estão disponíveis na agenda', () => {
    for (const servico of ['Banho','Banho e tosa','Corte de unhas','Hidratação','Cronograma de hidratação','Remoção de subpelos e pelos mortos','Desembolo','Limpeza de ouvidos']) {
      expect(SERVICOS_ESTETICOS_MATILHA).toContain(servico as typeof SERVICOS_ESTETICOS_MATILHA[number])
      expect(SUGESTOES_AGENDA.Estéticos).toContain(servico)
    }
  })
  test('não apresenta hospedagem entre os serviços estéticos', () => {
    expect(SERVICOS_ESTETICOS_MATILHA.some(servico => /hosped/i.test(servico))).toBe(false)
  })
  test('reconhece os cuidados estéticos sem classificar como gerais', () => {
    for (const nome of ['Desembolo','Remoção de subpelos e pelos mortos','Limpeza de ouvidos','Cronograma de hidratação','Corte de unhas','Tosa na máquina']) {
      expect(inferirCategoriaAgenda(nome)).toBe('Estéticos')
    }
  })
  test('preserva categoria histórica de hospedagem no tipo de agenda para não invalidar registros', () => {
    expect(CATEGORIAS_AGENDA).toContain('Hospedagens')
    expect(inferirCategoriaAgenda('Hospedagem histórica')).toBe('Hospedagens')
  })
})
