import { db } from '@/lib/db'
import { ensureFiscalDraftForSale } from '@/lib/fiscal-drafts'

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

async function resolveProduct(channel: MarketplaceChannel, item: MarketplaceSaleItem) {
  const where = [
    ...(channel === 'mercadolivre' && item.externalProductId ? [{ mlItemId: item.externalProductId }] : []),
    ...(channel === 'amazon' && item.externalProductId ? [{ amazonAsin: item.externalProductId }] : []),
    ...(item.sku ? [{ sku: item.sku }] : []),
  ]
  if (!where.length) return null
  const candidates = await db.produto.findMany({ where: { OR: where }, take: 10 })
  return candidates.find((product) => channel === 'mercadolivre'
    ? Boolean(item.externalProductId && product.mlItemId === item.externalProductId)
    : Boolean(item.externalProductId && product.amazonAsin === item.externalProductId))
    || candidates.find((product) => Boolean(item.sku && product.sku === item.sku))
    || null
}

export async function registerMarketplaceSale(input: MarketplaceSaleInput) {
  const marketplaceOrderId = input.channel + ':' + input.orderId
  const existing = await db.venda.findUnique({ where: { marketplaceOrderId }, select: { id: true } })
  if (existing) {
    // Pedido já registrado (inclusive legado). Nunca debitar duas vezes.
    return { created: false, vendaId: existing.id, imported: true, status: 'registered', error: null }
  }
  if (!input.items.length) throw new Error('Pedido sem itens: ' + input.orderId)

  const resolved: Array<{ productId: string; nome: string; quantidade: number; unitPrice: number }> = []
  for (const item of input.items) {
    const product = await resolveProduct(input.channel, item)
    if (!product) throw new Error('Produto não encontrado no ERP local: ' + (item.sku || item.externalProductId || item.title || 'sem identificação'))
    resolved.push({
      productId: product.id,
      nome: product.nome,
      quantidade: Math.max(1, Math.floor(item.quantity)),
      unitPrice: Math.max(0, Number(item.unitPrice || 0)),
    })
  }
  const subtotal = resolved.reduce((value, item) => value + item.unitPrice * item.quantidade, 0)
  const total = Number.isFinite(input.total) && input.total > 0 ? input.total : subtotal
  const quantidades = new Map<string, number>()
  for (const item of resolved) quantidades.set(item.productId, (quantidades.get(item.productId) || 0) + item.quantidade)

  const resultado = await db.$transaction(async (tx) => {
    const venda = await tx.venda.create({
      data: {
        clienteId: null,
        total,
        subtotalProdutos: subtotal,
        descontoCupom: 0,
        canal: input.channel,
        status: 'concluida',
        marketplaceOrderId,
        marketplaceBuyerDocument: input.buyerDocument?.replace(/\D/g, '') || null,
        marketplaceBuyerName: input.buyerName?.trim() || null,
        observacoes: 'Venda de e-commerce ' + (input.channel === 'mercadolivre' ? 'Mercado Livre' : 'Amazon') + ' #' + input.orderId,
        tipoEntrega: 'marketplace',
        statusEntrega: 'pendente',
        createdAt: input.createdAt,
        itens: { create: resolved.map((item) => ({
          produtoId: item.productId, quantidade: item.quantidade, precoUnit: item.unitPrice,
        })) },
      },
    })

    const alertas: string[] = []
    for (const [id, quantidade] of quantidades) {
      const produto = await tx.produto.findUniqueOrThrow({ where: { id }, select: { nome: true, estoque: true } })
      const diferenca = Math.max(0, quantidade - Math.max(0, produto.estoque))
      // Mesmo um pedido com ruptura precisa ser registrado, pois a venda já aconteceu.
      // O saldo não pode ficar negativo; a divergência é sinalizada ao operador.
      const update = await tx.produto.updateMany({
        where: { id, estoque: { gte: quantidade } },
        data: { estoque: { decrement: quantidade } },
      })
      if (!update.count) {
        await tx.produto.update({ where: { id }, data: { estoque: 0, estoqueHub: 0 } })
        alertas.push('Revisar saldo de ' + produto.nome + ': faltam ' + diferenca + ' unidade(s).')
      } else {
        const atualizado = await tx.produto.findUniqueOrThrow({ where: { id }, select: { estoque: true } })
        await tx.produto.update({ where: { id }, data: { estoqueHub: atualizado.estoque } })
      }
    }
    await tx.venda.update({ where: { id: venda.id }, data: { marketplaceStockAppliedAt: new Date() } })
    return { id: venda.id, alertas }
  })
  // Uma venda confirmada de marketplace também recebe um único rascunho fiscal.
  // Antes de transmitir a NF-e, conciliar notas que possam ter sido emitidas no canal.
  try { await ensureFiscalDraftForSale(resultado.id) }
  catch (error) { console.error('[marketplace-sales] rascunho fiscal pendente:', error) }
  return {
    created: true,
    vendaId: resultado.id,
    imported: true,
    status: resultado.alertas.length ? 'stock_review' : 'registered',
    error: resultado.alertas.join(' ') || null,
  }
}
