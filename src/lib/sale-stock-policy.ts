/**
 * Movimentos de uma venda no estoque físico do Hub.
 *
 * Reservar/vender: -quantidade (feito na criação).
 * Cancelar pendente: +quantidade, pois era apenas uma reserva.
 * Cancelar concluída: zero automaticamente; devolução depende de conferência física.
 * Reabrir cancelada: bloquear sem conciliação, evitando duas baixas da mesma venda.
 */
export type SaleInventoryAction = 'none' | 'release-reservation' | 'manual-review'

export function inventoryActionForSaleStatus(
  previous: string,
  next: string,
): SaleInventoryAction {
  if(previous===next)return 'none'
  if(previous==='pendente' && next==='cancelada')return 'release-reservation'
  if(previous==='cancelada' && next!=='cancelada')return 'manual-review'
  return 'none'
}

export function canDeleteSaleWithoutLosingStockHistory(sale: {
  status: string
  marketplaceOrderId: string | null
}): boolean {
  // Não apagar vendas importadas: marketplaceOrderId é chave de idempotência.
  if(sale.marketplaceOrderId)return false
  // Não apagar venda concluída: quantidade já saiu e nota pode existir.
  return sale.status==='pendente' || sale.status==='cancelada'
}
