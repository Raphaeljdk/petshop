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

async function applyMarketplaceStockDelta(vendaId: string) {
  return db.$transaction(async (tx) => {
    const venda = await tx.venda.findUnique({
      where: { id: vendaId },
      select: {
        id: true,
        canal: true,
        siggmaImportedAt: true,
        marketplaceStockAppliedAt: true,
        itens: {
          select: {
            quantidade: true,
            produto: {
              select: {
                id: true,
                estoque: true,
                estoqueZetta: true,
                estoqueMercadoLivre: true,
                estoqueAmazon: true,
                zettaProCod: true,
              },
            },
          },
        },
      },
    })

    if (
      !venda ||
      !venda.siggmaImportedAt ||
      venda.marketplaceStockAppliedAt ||
      !['mercadolivre', 'amazon'].includes(venda.canal)
    ) {
      return false
    }

    for (const item of venda.itens) {
      if (!item.produto.zettaProCod) continue

      const quantidade = Math.max(1, Math.floor(item.quantidade))
      const novoSaldo = Math.max(
        0,
        Number(item.produto.estoqueZetta || item.produto.estoque || 0) - quantidade
      )

      await tx.produto.update({
        where: { id: item.produto.id },
        data: {
          estoque: novoSaldo,
          estoqueZetta: novoSaldo,
          ...(venda.canal === 'mercadolivre'
            ? {
                estoqueMercadoLivre: Math.max(
                  0,
                  Number(item.produto.estoqueMercadoLivre || 0) - quantidade
                ),
              }
            : {
                estoqueAmazon: Math.max(
                  0,
                  Number(item.produto.estoqueAmazon || 0) - quantidade
                ),
              }),
        },
      })
    }

    await tx.venda.update({
      where: { id: venda.id },
      data: { marketplaceStockAppliedAt: new Date() },
    })

    return true
  })
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
    if (!existing.siggmaImportedAt) {
      try {
        const result = await importarVendaNoSiggma(existing.id)
        if (result.imported) await applyMarketplaceStockDelta(existing.id)
        return {
          created: false,
          vendaId: existing.id,
          imported: result.imported,
          status: result.imported ? 'imported' : 'review',
          error: null,
        }
      } catch (error) {
        return {
          created: false,
          vendaId: existing.id,
          imported: false,
          status: 'review',
          error: error instanceof Error ? error.message : 'Falha ao reenviar venda ao Zetta.',
        }
      }
    }

    return {
      created: false,
      vendaId: existing.id,
      imported: true,
      status: existing.siggmaImportStatus,
      error: existing.siggmaImportError,
    }
  }

  if (!input.items.length) {
    throw new Error(`Pedido ${input.orderId} não possui itens para importar.`)
  }

  const resolved: Array<{
    item: MarketplaceSaleItem
    product: NonNullable<Awaited<ReturnType<typeof resolveProduct>>>
  }> = []
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
    if (result.imported) await applyMarketplaceStockDelta(venda.id)
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
