/**
 * Regras de publicação no ERP e ativação de anúncios do Mercado Livre.
 * Estoque físico confirmado no ERP (Produto.estoque) é a fonte única;
 * quantidade anunciada nos canais não determina o saldo físico.
 */
export type MarketplaceListingSnapshot = {
  status: string
  subStatus?: string[]
  tags?: string[]
  quantity: number
}

const REVIEW_SUBSTATUSES = new Set([
  'held','waiting_for_patch','forbidden','pending_documentation',
  'suspended','suspended_for_prevention','picture_download_pending',
  'picture_downloading_pending','payment_required',
])

export function shouldPublishLocalStock(stock: number, hasMarketplaceLink: boolean) {
  return hasMarketplaceLink && Number.isFinite(stock) && stock > 0
}
export type MlListingAction = 'none'|'update-stock'|'activate'|'update-stock-and-activate'|'blocked'

export function decideMercadoLivreListing(stock: number, listing: MarketplaceListingSnapshot): {
  action: MlListingAction
  reason?: string
} {
  const qty = Number.isFinite(stock) ? Math.max(0,Math.floor(stock)) : 0
  const status = (listing.status||'').toLowerCase()
  const substatus = (listing.subStatus||[]).map(s=>s.toLowerCase())
  const tags=(listing.tags||[]).map(s=>s.toLowerCase())
  if (['closed','under_review','inactive','not_yet_active','payment_required'].includes(status))
    return {action:'blocked',reason:'O Mercado Livre não permite reativação automática deste status: '+status}
  if (substatus.some(s=>REVIEW_SUBSTATUSES.has(s)) || tags.includes('moderation_penalty'))
    return {action:'blocked',reason:'Anúncio com revisão ou moderação pendente no Mercado Livre'}
  if (status!=='active'&&status!=='paused')
    return {action:'blocked',reason:'Status de anúncio não reconhecido: '+status}
  const remote=Number.isFinite(listing.quantity)?Math.max(0,Math.floor(listing.quantity)):0
  const quantityNeedsUpdate=remote!==qty
  if (qty===0){
    // Deixe anúncios pausados como estão; anúncios ativos recebem estoque zero
    // para que a plataforma pause naturalmente, sem forçar uma reativação.
    return {action:status==='active'&&quantityNeedsUpdate?'update-stock':'none'}
  }
  if (status==='paused') {
    // Nunca reativar um anúncio pausado pelo vendedor sem comando explícito.
    // Nem o botão genérico "Sincronizar agora" equivale à autorização de reativar.
    // Reposição futura exige confirmação do SKU, estoque físico e publicação.
    return {action:'none'}
  }
  return {action:quantityNeedsUpdate?'update-stock':'none'}
}
