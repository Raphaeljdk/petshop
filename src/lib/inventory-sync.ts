import { db } from '@/lib/db'
import { mercadoLivreAccessToken } from '@/lib/mercado-livre'
import { mercadoLivreUpdateStock } from '@/lib/mercado-livre-items'
import { amazonUpdateListingQuantity, AmazonSpApiError } from '@/lib/amazon-sp-api'
import { safeStock } from '@/lib/product-stock'
import { codigoCompartilhado } from '@/lib/product-sku-groups'
import { notifyRestockSubscribers } from '@/lib/restock-notifications'

export type InventorySyncResult = {
  products: number
  mercadoLivreUpdated: number
  amazonUpdated: number
  skippedUnlinked: number
  restockNotifications: {
    configured: boolean
    sent: number
    pending: number
    errors: string[]
  }
  errors: string[]
}

function amazonSubmissionHasError(payload: unknown) {
  if (!payload || typeof payload !== 'object') return false
  const issues = (payload as { issues?: Array<{ severity?: string }> }).issues
  return Boolean(
    issues?.some((issue) => String(issue.severity || '').toUpperCase() === 'ERROR')
  )
}

export async function syncLocalStockToMarketplaces(): Promise<InventorySyncResult> {
  // O Produto.estoque do ERP Matilha Prado é a única fonte física;
  // marketplaces recebem o saldo e nunca sobrescrevem o estoque local.
  // Considera também a posição do Zetta/local no diagnóstico do saldo físico.
  // Não cria sincronização se dois anúncios compartilham SKU e discordam sobre
  // a quantidade: alguém precisa confirmar a posição real antes de enviar.
  const allProducts = await db.produto.findMany({
    where:{ativo:true},
    select:{
      id:true,nome:true,sku:true,estoque:true,zettaProCod:true,mlItemId:true,
      amazonAsin:true,estoqueMercadoLivre:true,estoqueAmazon:true,
    },
  })
  const products=allProducts.filter(p=>p.mlItemId||p.amazonAsin)
  const estoquePorSku=new Map<string,Set<number>>()
  for(const p of allProducts){
    const sku=codigoCompartilhado(p.sku)
    if(!sku)continue
    const current=estoquePorSku.get(sku)||new Set<number>()
    current.add(safeStock(p.estoque));estoquePorSku.set(sku,current)
  }
  const skusComDivergencia=new Set([...estoquePorSku.entries()]
    .filter(([,saldos])=>saldos.size>1).map(([sku])=>sku))

  let mercadoLivreUpdated = 0
  let amazonUpdated = 0
  const errors: string[] = []

  const mlProducts = products.filter((product) => product.mlItemId)
  let mlToken: string | null = null
  if (mlProducts.length) {
    try {
      mlToken = (await mercadoLivreAccessToken()).token
    } catch (error) {
      errors.push(
        `Mercado Livre: ${error instanceof Error ? error.message : 'falha de autenticação'}`
      )
    }
  }

  const divergenciasAvisadas=new Set<string>()
  for (const product of products) {
    const sku=codigoCompartilhado(product.sku)
    if(sku && skusComDivergencia.has(sku)){
      if(!divergenciasAvisadas.has(sku)){
        errors.push('SKU '+sku+': saldos físicos diferentes entre anúncios/canais; sincronização bloqueada até conferência do estoque real.')
        divergenciasAvisadas.add(sku)
      }
      continue
    }
    const quantity = safeStock(product.estoque)

    if (
      product.mlItemId &&
      mlToken &&
      safeStock(product.estoqueMercadoLivre) !== quantity
    ) {
      try {
        await mercadoLivreUpdateStock(product.mlItemId, quantity, mlToken)
        await db.produto.update({
          where: { id: product.id },
          data: { estoqueMercadoLivre: quantity },
        })
        mercadoLivreUpdated += 1
      } catch (error) {
        errors.push(
          `${product.nome} / Mercado Livre: ${
            error instanceof Error ? error.message : 'falha ao atualizar estoque'
          }`
        )
      }
    }

    if (
      product.amazonAsin &&
      product.sku &&
      safeStock(product.estoqueAmazon) !== quantity
    ) {
      try {
        const submission = await amazonUpdateListingQuantity(product.sku, quantity)
        if (amazonSubmissionHasError(submission)) {
          throw new Error('A Amazon recebeu a atualização, mas retornou erro na submissão.')
        }
        await db.produto.update({
          where: { id: product.id },
          data: { estoqueAmazon: quantity },
        })
        amazonUpdated += 1
      } catch (error) {
        const message =
          error instanceof AmazonSpApiError || error instanceof Error
            ? error.message
            : 'falha ao atualizar estoque'
        errors.push(`${product.nome} / Amazon: ${message}`)
      }
    } else if (product.amazonAsin && !product.sku) {
      errors.push(
        `${product.nome} / Amazon: SKU ausente; não é possível sincronizar a quantidade.`
      )
    }
  }

  const skippedUnlinked = 0

  const restockNotifications = await notifyRestockSubscribers().catch((error) => ({
    configured: false,
    sent: 0,
    pending: 0,
    errors: [
      error instanceof Error
        ? error.message
        : 'Falha ao processar avisos de reposição.',
    ],
  }))

  return {
    products: products.length,
    mercadoLivreUpdated,
    amazonUpdated,
    skippedUnlinked,
    restockNotifications,
    errors: [...errors, ...restockNotifications.errors].slice(0, 50),
  }
}
