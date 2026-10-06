import { db } from '@/lib/db'
import { mercadoLivreAccessToken } from '@/lib/mercado-livre'
import { mercadoLivreUpdateStock } from '@/lib/mercado-livre-items'
import { amazonUpdateListingQuantity, AmazonSpApiError } from '@/lib/amazon-sp-api'
import { safeStock } from '@/lib/product-stock'
import { syncZettaProductsToLocal } from '@/lib/zetta-products'
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

export async function syncZettaStockToMarketplaces(
  options: { refreshZetta?: boolean } = {}
): Promise<InventorySyncResult> {
  // O ERP é a fonte física. Nunca propague saldo de marketplace para outro
  // marketplace, pois ambos podem estar mostrando as mesmas unidades.
  // Após uma venda externa recém-importada, a baixa local já representa o
  // novo saldo e não deve ser sobrescrita por uma leitura possivelmente atrasada.
  if (options.refreshZetta !== false) {
    await syncZettaProductsToLocal()
  }

  const products = await db.produto.findMany({
    where: {
      ativo: true,
      zettaProCod: { not: null },
      OR: [{ mlItemId: { not: null } }, { amazonAsin: { not: null } }],
    },
    select: {
      id: true,
      nome: true,
      sku: true,
      zettaProCod: true,
      mlItemId: true,
      amazonAsin: true,
      estoqueZetta: true,
      estoqueMercadoLivre: true,
      estoqueAmazon: true,
    },
  })

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

  for (const product of products) {
    const quantity = safeStock(product.estoqueZetta)

    // O campo operacional local acompanha o ERP, sem somar saldos de canais.
    await db.produto.update({
      where: { id: product.id },
      data: { estoque: quantity },
    })

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

  const skippedUnlinked = await db.produto.count({
    where: {
      ativo: true,
      zettaProCod: null,
      OR: [{ mlItemId: { not: null } }, { amazonAsin: { not: null } }],
    },
  })

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
