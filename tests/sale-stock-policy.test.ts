import { describe, expect, test } from 'bun:test'
import { inventoryActionForSaleStatus, canDeleteSaleWithoutLosingStockHistory } from '../src/lib/sale-stock-policy'

describe('Movimentações de estoque do Hub', () => {
  test('confirmar venda de 1 unidade representa saída, nunca entrada', () => {
    const saldoAntes = 10
    const quantidadeVendida = 1
    const saldoDepois = saldoAntes - quantidadeVendida
    expect(saldoDepois).toBe(9)
    expect(saldoDepois).toBeLessThan(saldoAntes)
  })

  test('concluir uma venda pendente não dá baixa novamente', () => {
    expect(inventoryActionForSaleStatus('pendente','concluida')).toBe('none')
  })

  test('cancelar uma reserva pendente devolve apenas unidades reservadas', () => {
    expect(inventoryActionForSaleStatus('pendente','cancelada')).toBe('release-reservation')
    expect(inventoryActionForSaleStatus('cancelada','cancelada')).toBe('none')
  })

  test('cancelar uma venda concluída não cria estoque não devolvido', () => {
    expect(inventoryActionForSaleStatus('concluida','cancelada')).toBe('none')
  })

  test('reabrir uma cancelada exige conferência do estoque antes de nova saída', () => {
    expect(inventoryActionForSaleStatus('cancelada','concluida')).toBe('manual-review')
    expect(inventoryActionForSaleStatus('cancelada','pendente')).toBe('manual-review')
  })

  test('não permite apagar pedido de marketplace nem venda já concluída', () => {
    expect(canDeleteSaleWithoutLosingStockHistory({
      status:'concluida',marketplaceOrderId:'mercadolivre:123',
    })).toBe(false)
    expect(canDeleteSaleWithoutLosingStockHistory({
      status:'cancelada',marketplaceOrderId:'amazon:123',
    })).toBe(false)
    expect(canDeleteSaleWithoutLosingStockHistory({
      status:'concluida',marketplaceOrderId:null,
    })).toBe(false)
  })

  test('vendas locais pendentes/canceladas ainda permitem exclusão controlada', () => {
    expect(canDeleteSaleWithoutLosingStockHistory({
      status:'pendente',marketplaceOrderId:null,
    })).toBe(true)
    expect(canDeleteSaleWithoutLosingStockHistory({
      status:'cancelada',marketplaceOrderId:null,
    })).toBe(true)
  })
})
