import { db } from '@/lib/db'
import { stockWritesEnabled } from '@/lib/marketplace-stock-safety'
import { syncLocalStockToMarketplaces } from '@/lib/inventory-sync'

/**
 * Saldos sempre persistem primeiro no Hub. Atualização no canal é best-effort,
 * com resultado explícito para o operador; erros externos não revertem a venda.
 */
export async function syncStockAfterHubWrite(ids: string[]) {
  const productIds=[...new Set(ids)].filter(Boolean)
  if(!productIds.length)return { status:'not-required' as const }
  if(!stockWritesEnabled())return { status:'suspended' as const }
  try {
    const linked=await db.produto.count({where:{id:{in:productIds},
      OR:[{mlItemId:{not:null}},{amazonAsin:{not:null}}]}})
    if(!linked)return {status:'not-required' as const}
    const result=await syncLocalStockToMarketplaces({productIds,force:true})
    return {
      status:result.blockedListings||result.errors.length?'attention' as const:'submitted' as const,
      mercadoLivreUpdated:result.mercadoLivreUpdated,
      amazonUpdated:result.amazonUpdated,
      errors:result.errors,
      blockedListings:result.blockedListings,
    }
  }catch(error){
    console.error('[hub] atualização de canais após movimentação:',error)
    return {status:'attention' as const,
      errors:['Estoque registrado no Hub; falha na atualização dos marketplaces. Consulte Integrações.']}
  }
}
