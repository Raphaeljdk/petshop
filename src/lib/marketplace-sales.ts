import { db } from '@/lib/db'
import { importarVendaNoSiggma } from '@/lib/siggma/orders'

export type MarketplaceChannel = 'mercadolivre' | 'amazon'

export type MarketplaceSaleItem = {
  externalProductId?: string | null
  sku?: string | null
  title?: string | null
  quantity: number
  unitPrice: number
}

export type MarketplaceSaleInput = {
  channel: MarketplaceChannel
  orderId: string
  createdAt: Date
  total: number
  buyerName?: string | null
  buyerDocument?: string | null
  items: MarketplaceSaleItem[]
}

function marketplaceKey(channel: MarketplaceChannel, orderId: string) {
  return `${channel}:${orderId}`
}

async function resolveProduct(
  channel: MarketplaceChannel,
  item: MarketplaceSaleItem
) {
  const conditions: Array<Record<string, unknown>> = []

  if (channel === 'mercadolivre' && item.externalProductId) {
    conditions.push({ mlItemId: item.externalProductId })
  }
  if (channel === 'amazon' && item.externalProductId) {
    conditions.push({ amazonAsin: item.externalProductId })
  }
  if (item.sku) conditions.push({ sku: item.sku })

  if (!conditions.length) return null

  const candidates = await db.produto.findMany({
    where: { OR: conditions as any },
    take: 10,
  })

  const exact = candidates.find((product) =>
    channel === 'mercadolivre'
      ? product.mlItemId === item.externalProductId
      : product.amazonAsin === item.externalProductId
  )

  return (
    exact ||
    candidates.find((product) => product.sku && product.sku === item.sku) ||
    null
  )
}

export async function registerMarketplaceSale(input: MarketplaceSaleInput) {
  const key = marketplaceKey(input.channel, input.orderId)
  const existing = await db.venda.findUnique({
    where: { marketplaceOrderId: key },
    select: {
      id: true,
      siggmaImportedAt: true,
      siggmaImportStatus: true,
      siggmaImportError: true,
    },
  })

  if (existing) {
    return {
      created: false,
      vendaId: existing.id,
      imported: Boolean(existing.siggmaImportedAt),
      status: existing.siggmaImportStatus,
      error: existing.siggmaImportError,
    }
  }

  if (!input.items.length) {
    throw new Error(`Pedido ${input.orderId} não possui itens para importar.`)
  }

  const resolved = []
  for (const item of input.items) {
    const product = await resolveProduct(input.channel, item)
    if (!product) {
      throw new Error(
        `Produto do pedido ${input.orderId} não encontrado no estoque unificado: ${item.sku || item.externalProductId || item.title || 'item sem identificação'}.`
      )
    }
    if (!product.zettaProCod) {
      throw new Error(
        `Produto ${product.nome} ainda não está vinculado ao Zetta; a venda ${input.orderId} não foi enviada ao ERP.`
      )
    }

    resolved.push({ item, product })
  }

  const subtotal = resolved.reduce(
    (sum, row) => sum + row.item.unitPrice * row.item.quantity,
    0
  )
  const total = Number.isFinite(input.total) && input.total > 0 ? input.total : subtotal

  const venda = await db.venda.create({
    data: {
      clienteId: null,
      total,
      subtotalProdutos: subtotal,
      descontoCupom: 0,
      canal: input.channel,
      status: 'concluida',
      marketplaceOrderId: key,
      marketplaceBuyerDocument: input.buyerDocument?.replace(/\D/g, '') || null,
      marketplaceBuyerName: input.buyerName?.trim() || null,
      observacoes:
        input.channel === 'mercadolivre'
          ? `Venda de e-commerce Mercado Livre #${input.orderId}`
          : `Venda de e-commerce Amazon #${input.orderId}`,
      tipoEntrega: 'marketplace',
      statusEntrega: 'pendente',
      createdAt: input.createdAt,
      itens: {
        create: resolved.map(({ item, product }) => ({
          produtoId: product.id,
          quantidade: Math.max(1, Math.floor(item.quantity)),
          precoUnit: Math.max(0, Number(item.unitPrice || 0)),
        })),
      },
    },
  })

  try {
    const result = await importarVendaNoSiggma(venda.id)
    return {
      created: true,
      vendaId: venda.id,
      imported: result.imported,
      status: result.imported ? 'imported' : result.reason,
      error: null,
    }
  } catch (error) {
    return {
      created: true,
      vendaId: venda.id,
      imported: false,
      status: 'review',
      error: error instanceof Error ? error.message : 'Falha ao importar venda no Zetta.',
    }
  }
}
