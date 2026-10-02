import { describe, expect, test } from 'bun:test'
import {
  officialStockFromSources,
  safeStock,
  stockAccounting,
  totalStockFromSources,
} from '../src/lib/product-stock'

describe('estoque centralizado Matilha Prado', () => {
  test('Zetta é sempre a fonte operacional quando o produto está vinculado ao ERP', () => {
    expect(
      officialStockFromSources({
        zettaProCod: 101,
        estoqueZetta: 8,
        estoqueHub: 50,
        estoqueMercadoLivre: 0,
        estoqueAmazon: 0,
      })
    ).toBe(8)

    expect(
      officialStockFromSources({
        zettaProCod: 101,
        estoqueZetta: 0,
        estoqueMercadoLivre: 12,
        estoqueAmazon: 9,
      })
    ).toBe(0)
  })

  test('quantidades de marketplaces não são somadas ao estoque físico', () => {
    expect(
      officialStockFromSources({
        zettaProCod: null,
        estoqueHub: 0,
        estoqueMercadoLivre: 4,
        estoqueAmazon: 7,
      })
    ).toBe(7)

    expect(
      totalStockFromSources({
        estoqueHub: 0,
        estoqueZetta: 0,
        estoqueMercadoLivre: 4,
        estoqueAmazon: 7,
      })
    ).toBe(11)
  })

  test('Hub tem prioridade para produto sem vínculo Zetta', () => {
    expect(
      officialStockFromSources({
        zettaProCod: null,
        estoqueHub: 3,
        estoqueMercadoLivre: 20,
        estoqueAmazon: 20,
      })
    ).toBe(3)
  })

  test('saldos inválidos ou negativos nunca viram estoque disponível', () => {
    expect(safeStock(-4)).toBe(0)
    expect(safeStock(Number.NaN)).toBe(0)

    expect(
      stockAccounting({
        estoqueZetta: -1,
        estoqueMercadoLivre: 2,
        estoqueAmazon: 3,
        estoqueHub: 0,
      })
    ).toEqual({
      zetta: 0,
      mercadoLivre: 2,
      amazon: 3,
      hub: 0,
      reportedTotal: 5,
    })
  })
})
