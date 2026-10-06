import { db } from '@/lib/db'
import { mercadoLivreAccessToken } from '@/lib/mercado-livre'
import {
  amazonOrderItems,
  amazonOrdersUpdatedSince,
  AmazonSpApiError,
} from '@/lib/amazon-sp-api'
import { registerMarketplaceSale } from '@/lib/marketplace-sales'

type MlOrderItem = {
  item?: {
    id?: string
    title?: string
    seller_sku?: string | null
    seller_custom_field?: string | null
  }
  seller_sku?: string | null
  quantity?: number
  unit_price?: number
}

type MlOrder = {
  id?: number | string
  status?: string
  date_created?: string
  date_last_updated?: string
  total_amount?: number
  buyer?: {
    first_name?: string | null
    last_name?: string | null
    billing_info?: { id?: string | number | null } | null
  }
  order_items?: MlOrderItem[]
}

type MlSearchResponse = {
  results?: MlOrder[]
  paging?: { total?: number; offset?: number; limit?: number }
}

type MlBillingResponse = {
  buyer?: {
    billing_info?: {
      name?: string | null
      last_name?: string | null
      identification?: {
        type?: string | null
        number?: string | null
      } | null
    } | null
  } | null
}

function lookback(lastSync?: Date | null) {
  const now = Date.now()
  const initial = now - 24 * 60 * 60 * 1000
  if (!lastSync) return new Date(initial)
  return new Date(Math.max(initial, lastSync.getTime() - 6 * 60 * 60 * 1000))
}

async function mlJson<T>(url: URL | string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      `Mercado Livre respondeu HTTP ${response.status}${
        payload?.message ? `: ${payload.message}` : ''
      }`
    )
  }
  return payload as T
}

async function mercadoLivreBuyer(
  orderId: string,
  token: string
): Promise<{ name: string | null; document: string | null }> {
  try {
    const order = await mlJson<MlOrder>(
      `https://api.mercadolibre.com/orders/${encodeURIComponent(orderId)}`,
      token
    )
    const billingId = order.buyer?.billing_info?.id
    const fallbackName = [order.buyer?.first_name, order.buyer?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim()

    if (!billingId) {
      return { name: fallbackName || null, document: null }
    }

    const billing = await mlJson<MlBillingResponse>(
      `https://api.mercadolibre.com/orders/billing-info/MLB/${encodeURIComponent(
        String(billingId)
      )}`,
      token
    )
    const info = billing.buyer?.billing_info
    const name = [info?.name, info?.last_name].filter(Boolean).join(' ').trim()
    const document = info?.identification?.number?.replace(/\D/g, '') || null

    return {
      name: name || fallbackName || null,
      document,
    }
  } catch (error) {
    console.error('[marketplace-sync] billing Mercado Livre indisponível:', orderId, error)
    return { name: null, document: null }
  }
}

async function syncMercadoLivre() {
  const integration = await db.integracao.findUnique({
    where: { id: 'mercado-livre-orders' },
    select: { ultimaSync: true },
  })
  const since = lookback(integration?.ultimaSync)
  const { token, sellerId } = await mercadoLivreAccessToken()
  const orders: MlOrder[] = []
  let offset = 0
  const limit = 50

  while (orders.length < 100) {
    const url = new URL('https://api.mercadolibre.com/orders/search')
    url.searchParams.set('seller', sellerId)
    url.searchParams.set('order.status', 'paid')
    url.searchParams.set('order.date_last_updated.from', since.toISOString())
    url.searchParams.set('sort', 'date_desc')
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))

    const page = await mlJson<MlSearchResponse>(url, token)
    const rows = page.results || []
    orders.push(...rows)

    const total = Number(page.paging?.total || rows.length)
    offset += rows.length
    if (!rows.length || offset >= total || orders.length >= 100) break
  }

  let created = 0
  let imported = 0
  const errors: string[] = []

  for (const order of orders.slice(0, 100)) {
    if (!order.id || order.status !== 'paid') continue
    const orderId = String(order.id)
    const buyer = await mercadoLivreBuyer(orderId, token)

    try {
      const result = await registerMarketplaceSale({
        channel: 'mercadolivre',
        orderId,
        createdAt: order.date_created ? new Date(order.date_created) : new Date(),
        total: Math.max(0, Number(order.total_amount || 0)),
        buyerName: buyer.name,
        buyerDocument: buyer.document,
        items: (order.order_items || []).map((row) => ({
          externalProductId: row.item?.id || null,
          sku: row.seller_sku || row.item?.seller_sku || row.item?.seller_custom_field || null,
          title: row.item?.title || null,
          quantity: Math.max(1, Math.floor(Number(row.quantity || 1))),
          unitPrice: Math.max(0, Number(row.unit_price || 0)),
        })),
      })
      if (result.created) created += 1
      if (result.imported) imported += 1
      if (result.error) errors.push(`ML ${orderId}: ${result.error}`)
    } catch (error) {
      errors.push(
        `ML ${orderId}: ${error instanceof Error ? error.message : 'falha desconhecida'}`
      )
    }
  }

  await db.integracao.upsert({
    where: { id: 'mercado-livre-orders' },
    create: {
      id: 'mercado-livre-orders',
      plataforma: 'mercado_livre_orders',
      ativo: true,
      sellerId,
      domain: 'mercadolivre.com.br',
      ultimaSync: new Date(),
    },
    update: {
      ativo: true,
      sellerId,
      ultimaSync: new Date(),
    },
  })

  return {
    checked: orders.length,
    created,
    imported,
    errors: errors.slice(0, 20),
  }
}

async function syncAmazon() {
  const integration = await db.integracao.findUnique({
    where: { id: 'amazon-orders' },
    select: { ultimaSync: true },
  })
  const since = lookback(integration?.ultimaSync)
  const catalog = await amazonOrdersUpdatedSince(since, 100)

  let created = 0
  let imported = 0
  const errors: string[] = []

  for (const order of catalog.orders) {
    try {
      const items = await amazonOrderItems(order.orderId)
      const result = await registerMarketplaceSale({
        channel: 'amazon',
        orderId: order.orderId,
        createdAt: new Date(order.purchaseDate),
        total: order.total,
        buyerName: order.buyerName,
        buyerDocument: null,
        items: items.map((item) => ({
          externalProductId: item.asin,
          sku: item.sellerSku,
          title: item.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      })
      if (result.created) created += 1
      if (result.imported) imported += 1
      if (result.error) errors.push(`Amazon ${order.orderId}: ${result.error}`)
    } catch (error) {
      errors.push(
        `Amazon ${order.orderId}: ${error instanceof Error ? error.message : 'falha desconhecida'}`
      )
    }
  }

  await db.integracao.upsert({
    where: { id: 'amazon-orders' },
    create: {
      id: 'amazon-orders',
      plataforma: 'amazon_orders',
      ativo: true,
      sellerId: catalog.sellerId,
      domain: 'amazon.com.br',
      ultimaSync: new Date(),
    },
    update: {
      ativo: true,
      sellerId: catalog.sellerId,
      ultimaSync: new Date(),
    },
  })

  return {
    checked: catalog.orders.length,
    created,
    imported,
    errors: errors.slice(0, 20),
  }
}

export async function syncMarketplaceSalesToZetta() {
  const result: {
    mercadoLivre?: Awaited<ReturnType<typeof syncMercadoLivre>>
    amazon?: Awaited<ReturnType<typeof syncAmazon>>
    mercadoLivreError?: string
    amazonError?: string
  } = {}

  try {
    result.mercadoLivre = await syncMercadoLivre()
  } catch (error) {
    result.mercadoLivreError =
      error instanceof Error ? error.message : 'Falha ao sincronizar vendas do Mercado Livre.'
  }

  try {
    result.amazon = await syncAmazon()
  } catch (error) {
    result.amazonError =
      error instanceof AmazonSpApiError || error instanceof Error
        ? error.message
        : 'Falha ao sincronizar vendas da Amazon.'
  }

  return result
}
