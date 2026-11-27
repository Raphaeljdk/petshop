import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { syncMarketplaceSalesToLocal } from '@/lib/marketplace-sync'
import { syncLocalStockToMarketplaces } from '@/lib/inventory-sync'
import { stockWritesEnabled } from '@/lib/marketplace-stock-safety'

// A rotina nao usa estoques externos como saldos fisicos.
// Primeiro importa pedidos pagos, depois distribui o saldo do ERP.
// Um lease evita duas chamadas concorrentes pelo cron e pelo painel.
const JOB_ID='marketplaces'
const LEASE_MS=7*60*1000
export async function marketplaceSyncStatus() {
  return db.marketplaceSyncRun.findUnique({where:{id:JOB_ID},
    select:{status:true,lastStartedAt:true,lastFinishedAt:true,lastSuccessAt:true,
      lastMlUpdated:true,lastMlActivated:true,lastLocalPublished:true,lastLocalHidden:true,
      lastBlockedListings:true,lastAmazonUpdated:true,lastSalesImported:true,lastErrors:true}})
}

export async function runMarketplacesSync(options: { force?: boolean } = {}) {
  const started=new Date()
  const token=randomUUID()
  await db.marketplaceSyncRun.createMany({data:[{id:JOB_ID}],skipDuplicates:true})
  const acquired=await db.marketplaceSyncRun.updateMany({
    where:{id:JOB_ID,OR:[{leaseUntil:null},{leaseUntil:{lte:started}}]},
    data:{leaseToken:token,leaseUntil:new Date(started.getTime()+LEASE_MS),
      status:'running',lastStartedAt:started},
  })
  if(!acquired.count)return {ok:true,busy:true,status:await marketplaceSyncStatus()}
  try{
    const sales=await syncMarketplaceSalesToLocal()
    // Segurança: após divergências no estoque, NÃO escrever quantidades nos canais
    // nem reativar anúncios com base no ERP até haver conferência e opt-in explícito.
    // A importação de pedidos permanece ativa para não perder baixas legítimas.
    const stock=stockWritesEnabled() && options.force
      ?await syncLocalStockToMarketplaces({force:true})
      :{
        products:0,mercadoLivreUpdated:0,mercadoLivreActivated:0,amazonUpdated:0,
        localPublished:0,localHidden:0,skippedUnlinked:0,blockedListings:0,
        restockNotifications:{configured:false,sent:0,pending:0,errors:[] as string[]},
        errors:[] as string[],
      }
    const errors=[
      ...(sales.mercadoLivreError?['Mercado Livre pedidos: '+sales.mercadoLivreError]:[]),
      ...(sales.amazonError?['Amazon pedidos: '+sales.amazonError]:[]),
      ...(sales.mercadoLivre?.errors||[]),
      ...(sales.amazon?.errors||[]),
      ...stock.errors,
    ]
    const ml=stock.mercadoLivreUpdated
    const amazon=stock.amazonUpdated
    const imported=(sales.mercadoLivre?.created||0)+(sales.amazon?.created||0)
    const ended=new Date()
    await db.marketplaceSyncRun.updateMany({where:{id:JOB_ID,leaseToken:token},data:{
      leaseToken:null,leaseUntil:null,status:errors.length?'partial':'success',
      lastFinishedAt:ended,...(!errors.length?{lastSuccessAt:ended}:{}),
      lastMlUpdated:ml,lastMlActivated:stock.mercadoLivreActivated,
      lastLocalPublished:stock.localPublished,lastLocalHidden:stock.localHidden,
      lastBlockedListings:stock.blockedListings,lastAmazonUpdated:amazon,lastSalesImported:imported,
      lastErrors:errors.slice(0,25).join('\n').slice(0,5000)||null,
    }})
    return {ok:errors.length===0,busy:false,stockWritesEnabled:stockWritesEnabled(),
      checked:{mercadoLivre:sales.mercadoLivre?.checked||0,amazon:sales.amazon?.checked||0},
      imported,mercadoLivreUpdated:ml,mercadoLivreActivated:stock.mercadoLivreActivated,
      localPublished:stock.localPublished,localHidden:stock.localHidden,
      blockedListings:stock.blockedListings,amazonUpdated:amazon,
      errors:errors.slice(0,25),lastSync:ended.toISOString()}
  }catch(error){
    const message=error instanceof Error?error.message:'Erro inesperado na conciliacao.'
    await db.marketplaceSyncRun.updateMany({where:{id:JOB_ID,leaseToken:token},
      data:{leaseToken:null,leaseUntil:null,status:'error',lastFinishedAt:new Date(),
        lastErrors:message.slice(0,2000)}})
    throw error
  }
}
