import { db } from '@/lib/db'
import { quantityToPublishFromHub } from '@/lib/marketplace-stock-safety'
import { mercadoLivreAccessToken } from '@/lib/mercado-livre'
import { mercadoLivreItemsByIds, mercadoLivreUpdateListingStatus, mercadoLivreUpdateStock } from '@/lib/mercado-livre-items'
import { amazonUpdateListingQuantity, AmazonSpApiError } from '@/lib/amazon-sp-api'
import { isServiceProduct, safeStock } from '@/lib/product-stock'
import { codigoCompartilhado } from '@/lib/product-sku-groups'
import { notifyRestockSubscribers } from '@/lib/restock-notifications'
import { decideMercadoLivreListing } from '@/lib/marketplace-publish-policy'

export type InventorySyncResult = {
  products:number
  mercadoLivreUpdated:number
  mercadoLivreActivated:number
  amazonUpdated:number
  localPublished:number
  localHidden:number
  skippedUnlinked:number
  blockedListings:number
  restockNotifications:{configured:boolean;sent:number;pending:number;errors:string[]}
  errors:string[]
}

type Channel='mercadolivre'|'amazon'
function amazonSubmissionHasError(payload: unknown) {
  const issues=(payload as {issues?:Array<{severity?:string}>}|null)?.issues
  return Boolean(issues?.some(x=>String(x.severity||'').toUpperCase()==='ERROR'))
}
function reason(error:unknown){return error instanceof Error?error.message:String(error)}
function issueType(error:unknown){
  const message=reason(error)
  return /UNAUTHORIZED|not authorized|access.denied|access_denied|permission|policy|HTTP 40[13]/i.test(message)
    ? 'permission' : 'remote_error'
}

export async function syncLocalStockToMarketplaces(
  options:{force?:boolean; productIds?:string[]; explicitlyPublishIds?:string[]}={}
):Promise<InventorySyncResult>{
  // O estoque físico único e o SKU do ERP determinam a publicação na vitrine.
  // As quantidades observadas em ML/Amazon não se somam ao estoque físico.
  const all=await db.produto.findMany({
    where:{OR:[{mlItemId:{not:null}},{amazonAsin:{not:null}}]},
    select:{id:true,nome:true,categoria:true,sku:true,ativo:true,estoque:true,
      estoqueIlimitado:true,mlItemId:true,amazonAsin:true,estoqueMercadoLivre:true,estoqueAmazon:true},
  })
  const products=all.filter(p=>!isServiceProduct(p))
  const selected=options.productIds
    ?products.filter(p=>options.productIds!.includes(p.id))
    :products
  // Nunca reativar produtos descontinuados/ocultos só porque estoque > 0.
  // A loja só pode publicar novamente por ação explícita do administrador.
  const localPublished=0
  const hide=selected.filter(p=>p.estoque<=0&&p.ativo)
  const localHidden=hide.length?(await db.produto.updateMany({
    where:{id:{in:hide.map(p=>p.id)},ativo:true,estoque:{lte:0}},data:{ativo:false},
  })).count:0

  const errors:string[]=[]
  let mercadoLivreUpdated=0,mercadoLivreActivated=0,amazonUpdated=0,blockedListings=0
  const mlCounts=new Map<string,number>()
  const skuStocks=new Map<string,Set<number>>()
  const skuCounts=new Map<string,number>()
  for(const product of products){
    if(product.mlItemId)mlCounts.set(product.mlItemId,(mlCounts.get(product.mlItemId)||0)+1)
    const sku=codigoCompartilhado(product.sku)
    if(sku){const vals=skuStocks.get(sku)||new Set<number>()
      vals.add(safeStock(product.estoque));skuStocks.set(sku,vals)
      skuCounts.set(sku,(skuCounts.get(sku)||0)+1)}
  }
  const ambiguousIds=new Set([...mlCounts.entries()].filter(([,n])=>n>1).map(([id])=>id))
  const divergentSkus=new Set([...skuStocks.entries()]
    .filter(([,s])=>s.size>1).map(([sku])=>sku))
  const duplicatedSkus=new Set([...skuCounts.entries()]
    .filter(([,count])=>count>1).map(([sku])=>sku))
  const blocked=await db.marketplaceStockIssue.findMany({
    where:{resolvedAt:null,retryAfter:{gt:new Date()}},select:{id:true,category:true},
  })
  const cooldownIds=new Set(blocked.map(x=>x.id))
  const issuesAlreadyReported=new Set<string>()
  const putIssue=async(channel:Channel,key:string,productId:string,title:string,message:string,
    category?:string)=>{
    const cls=category||issueType(message)
    const waitMs=cls==='permission'?6*60*60*1000:cls==='blocked_status'||cls==='variant_mapping'
      ?24*60*60*1000:30*60*1000
    const id=channel+':'+key
    await db.marketplaceStockIssue.upsert({where:{id},create:{
      id,channel,productId,title,category:cls,error:message.slice(0,700),
      retryAfter:new Date(Date.now()+waitMs),
    },update:{productId,title,category:cls,error:message.slice(0,700),
      retryAfter:new Date(Date.now()+waitMs),resolvedAt:null}})
  }
  const clearIssue=async(channel:Channel,key:string)=>{
    await db.marketplaceStockIssue.updateMany({
      where:{id:channel+':'+key,resolvedAt:null},
      data:{resolvedAt:new Date(),retryAfter:null},
    })
  }

  let mlToken:string|null=null
  let mlSellerId:string|null=null
  let remoteItems=new Map<string,Awaited<ReturnType<typeof mercadoLivreItemsByIds>>[number]>()
  const mlIds=[...new Set(selected.map(p=>p.mlItemId).filter((v):v is string=>Boolean(v)))]
  if(mlIds.length){
    try{
      const access=await mercadoLivreAccessToken()
      mlToken=access.token
      mlSellerId=access.sellerId
      const fetched=await mercadoLivreItemsByIds(mlIds,mlToken)
      remoteItems=new Map(fetched.map(item=>[item.id,item]))
      if(fetched.length<mlIds.length)
        errors.push('Mercado Livre: '+(mlIds.length-fetched.length)+
          ' anúncio(s) não retornaram dados válidos da API; nenhuma mudança será feita neles.')
    }catch(error){
      errors.push('Mercado Livre: não foi possível validar status e quantidade antes de atualizar: '+reason(error))
      mlToken=null
    }
  }

  // Limite conservador por execução; os demais anúncios são reavaliados no próximo cron.
  // Impede sobrecarga e funções interrompidas no meio de uma operação em lote.
  const MAX_ML_OPERATIONS=120
  const MAX_STOCK_SYNC_MS=180_000
  const stockStartedAt=Date.now()
  let mlOperations=0
  for(const product of selected){
    // Hub é a autoridade: produto oculto/descontinuado publica ZERO,
    // independentemente de saldos físicos ainda registrados.
    const quantity=quantityToPublishFromHub(product)
    const sku=codigoCompartilhado(product.sku)
    if(sku&&duplicatedSkus.has(sku)){
      if(!issuesAlreadyReported.has(sku)){
        errors.push('SKU '+sku+': '+skuCounts.get(sku)+' cadastros espelhados'+
          (divergentSkus.has(sku)?' com saldos divergentes':'')+
          '. Conferir vínculo e estoque único antes de enviar alterações aos canais.')
        issuesAlreadyReported.add(sku)
      }
      blockedListings++
      continue
    }

    if(product.mlItemId){
      const id=product.mlItemId
      const issueId='mercadolivre:'+id
      if(ambiguousIds.has(id)){
        if(!issuesAlreadyReported.has(id)){
          const msg='Anúncio '+id+' vinculado a diferentes produtos: identificar variation_id de cada SKU antes de atualizar.'
          errors.push(msg)
          await putIssue('mercadolivre',id,product.id,product.nome,msg,'variant_mapping').catch(console.error)
          issuesAlreadyReported.add(id)
        }
        blockedListings++
      }else if(!mlToken){
        // Erro de autenticação já registrado; não tentar PUT sem verificação.
      }else if(!options.force&&cooldownIds.has(issueId)){
        blockedListings++
      }else{
        const remote=remoteItems.get(id)
        if(!remote){
          blockedListings++
          if(!issuesAlreadyReported.has(id)){
            errors.push('Mercado Livre: anúncio '+id+' sem status confiável no retorno da API.')
            issuesAlreadyReported.add(id)
          }
        }else if(remote.sellerId&&mlSellerId&&remote.sellerId!==mlSellerId){
          blockedListings++
          await putIssue('mercadolivre',id,product.id,product.nome,
            'O anúncio pertence a outra conta vendedora. Conferir vínculo e vendedor na integração.','permission')
            .catch(console.error)
        }else{
          const decision=decideMercadoLivreListing(quantity,remote,{
            explicitAdminActivation:options.explicitlyPublishIds?.includes(product.id)===true,
          })
          if(decision.action==='blocked'){
            blockedListings++
            await putIssue('mercadolivre',id,product.id,product.nome,
              decision.reason||'Estado do anúncio não permite atualização automática.','blocked_status')
              .catch(console.error)
          }else if(decision.action==='none'&&String(remote.status).toLowerCase()==='paused'&&
            remote.quantity!==quantity){
            blockedListings++
            const msg='Anúncio pausado: estoque salvo no Hub, mas a quantidade no Mercado Livre não foi alterada. Reative explicitamente no Hub quando a publicação for permitida.'
            if(!issuesAlreadyReported.has(id)){ errors.push(product.nome+' / Mercado Livre: '+msg);issuesAlreadyReported.add(id) }
            await putIssue('mercadolivre',id,product.id,product.nome,msg,'blocked_status').catch(console.error)
          }else if(decision.action!=='none'&&
            (mlOperations>=MAX_ML_OPERATIONS||Date.now()-stockStartedAt>MAX_STOCK_SYNC_MS)){
            blockedListings++
            if(!issuesAlreadyReported.has('limit')){
              errors.push('Mercado Livre: limite de operações/tempo por execução atingido; demais anúncios serão avaliados no próximo ciclo.')
              issuesAlreadyReported.add('limit')
            }
          }else{
            try{
              if(decision.action==='update-stock'||decision.action==='update-stock-and-activate'){
                await mercadoLivreUpdateStock(id,quantity,mlToken)
                mlOperations++
                await db.produto.update({where:{id:product.id},data:{estoqueMercadoLivre:quantity}})
                mercadoLivreUpdated++
              }else if(product.estoqueMercadoLivre!==remote.quantity){
                await db.produto.update({where:{id:product.id},
                  data:{estoqueMercadoLivre:remote.quantity}})
              }
              if(decision.action==='activate'||decision.action==='update-stock-and-activate'){
                const result=await mercadoLivreUpdateListingStatus(id,'active',mlToken)
                mlOperations++
                if(result.status!=='active')
                  throw new Error('O Mercado Livre não confirmou o status active para '+id)
                mercadoLivreActivated++
              }
              await clearIssue('mercadolivre',id)
            }catch(error){
              const msg=reason(error)
              await putIssue('mercadolivre',id,product.id,product.nome,msg).catch(console.error)
              errors.push(product.nome+' / Mercado Livre: '+msg)
              blockedListings++
            }
          }
        }
      }
    }

    if(product.amazonAsin){
      if(!product.sku){
        errors.push(product.nome+' / Amazon: SKU ausente; estoque não enviado.')
      }else if(quantity!==safeStock(product.estoqueAmazon)){
        const issueId='amazon:'+product.sku
        if(!options.force&&cooldownIds.has(issueId)){
          blockedListings++
        }else{
          try{
            const submission=await amazonUpdateListingQuantity(product.sku,quantity)
            if(amazonSubmissionHasError(submission))
              throw new Error('Amazon retornou erro na submissão de estoque.')
            // Resposta da SP-API confirma recebimento da submissão, não a mudança
            // definitiva da disponibilidade (esta exige conciliação posterior).
            await db.produto.update({where:{id:product.id},data:{estoqueAmazon:quantity}})
            await clearIssue('amazon',product.sku)
            amazonUpdated++
          }catch(error){
            const msg=error instanceof AmazonSpApiError||error instanceof Error
              ?error.message:'Falha ao enviar estoque.'
            await putIssue('amazon',product.sku,product.id,product.nome,msg).catch(console.error)
            errors.push(product.nome+' / Amazon: '+msg)
            blockedListings++
          }
        }
      }
    }
  }
  // Desativado por padrão até domínio Resend validado. Não transformar
  // sincronização de estoque em disparos de e-mails sem opt-in operacional.
  const restockNotifications=process.env.RESTOCK_NOTIFICATIONS_ENABLED==='true'
    ?await notifyRestockSubscribers().catch(error=>({configured:false,sent:0,pending:0,
      errors:[reason(error)]}))
    :{configured:false,sent:0,pending:0,errors:[] as string[]}

  return {
    products:selected.length,mercadoLivreUpdated,mercadoLivreActivated,amazonUpdated,
    localPublished,localHidden,skippedUnlinked:0,
    blockedListings,restockNotifications,
    errors:[...errors,...restockNotifications.errors].slice(0,50),
  }
}
