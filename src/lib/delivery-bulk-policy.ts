/**
 * Entregas marcadas manualmente como concluídas só podem ser da operação
 * própria da loja. O frete de marketplace é controlado pelo respectivo canal.
 * Cancelamento de venda não é entrega, ainda que tenha sido um pedido de teste.
 */
export const LOCAL_DELIVERY_TYPES=['entrega_propria','sedex','melhor_envio'] as const
export const LOCAL_DELIVERY_CHANNELS=['site','loja'] as const

export type DeliveryCandidate={
  canal:string|null
  status:string|null
  tipoEntrega:string|null
  statusEntrega:string|null
}

export function canCompleteLocalDelivery(item:DeliveryCandidate):boolean{
  return LOCAL_DELIVERY_CHANNELS.some(c=>c===item.canal)
    && LOCAL_DELIVERY_TYPES.some(t=>t===item.tipoEntrega)
    && item.status==='concluida'
    && (item.statusEntrega==null||item.statusEntrega==='pendente'||item.statusEntrega==='enviada')
}
