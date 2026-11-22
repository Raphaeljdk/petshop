/**
 * O Hub é a fonte única de saldo físico.
 *
 * A liberação de escrita em ML/Amazon exige estoque e vínculos conciliados:
 * não ativar a variável em produção antes da validação.
 */
export function stockWritesEnabled(value: string | undefined = process.env.MARKETPLACE_STOCK_WRITES_ENABLED) {
  return value === 'true'
}

export type HubStockSnapshot = {
  estoque: number
  ativo: boolean
  sku: string | null
  mlItemId: string | null
  amazonAsin: string | null
}

/** Produto oculto publica quantidade zero, mesmo que haja saldo físico em depósito. */
export function quantityToPublishFromHub(product: Pick<HubStockSnapshot,'estoque'|'ativo'>): number {
  if(!product.ativo)return 0
  if(!Number.isFinite(product.estoque))return 0
  return Math.max(0,Math.floor(product.estoque))
}

export function hubChangeNeedsMarketplaceSync(before: HubStockSnapshot, after: HubStockSnapshot): boolean {
  const linked=Boolean(after.mlItemId||after.amazonAsin)
  if(!linked)return false
  return before.ativo!==after.ativo
    ||quantityToPublishFromHub(before)!==quantityToPublishFromHub(after)
    ||before.mlItemId!==after.mlItemId ||before.amazonAsin!==after.amazonAsin
    ||before.sku!==after.sku
}
