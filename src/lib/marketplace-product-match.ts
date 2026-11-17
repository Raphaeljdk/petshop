export type MarketplaceMatchChannel='mercadolivre'|'amazon'
export type MarketplaceCandidate={
  id:string; sku:string|null;mlItemId:string|null;amazonAsin:string|null
}
export type MarketplaceLookupItem={sku?:string|null;externalProductId?:string|null}

/** O item_id do ML pode representar várias variantes; o SKU deve ser único. */
export function pickMarketplaceProduct<T extends MarketplaceCandidate>(
  candidates:T[],channel:MarketplaceMatchChannel,item:MarketplaceLookupItem
):T|null{
  if(item.sku){
    const matches=candidates.filter(p=>p.sku===item.sku)
    if(matches.length===1)return matches[0]
    if(matches.length>1){
      // Um EAN/SKU pode estar espelhado em anúncios de múltiplos canais.
      // Identificar a linha exata do canal evita baixar estoque no espelho errado.
      if(item.externalProductId){
        const exact=matches.filter(p=>channel==='mercadolivre'
          ? p.mlItemId===item.externalProductId
          : p.amazonAsin===item.externalProductId)
        if(exact.length===1)return exact[0]
      }
      return null
    }
  }
  const matches=candidates.filter(p=>channel==='mercadolivre'
    ?Boolean(item.externalProductId&&p.mlItemId===item.externalProductId)
    :Boolean(item.externalProductId&&p.amazonAsin===item.externalProductId))
  return matches.length===1?matches[0]:null
}
