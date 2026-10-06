import 'server-only'

import { createHash } from 'node:crypto'

const DEFAULT_ENDPOINT = 'https://sellingpartnerapi-na.amazon.com'
const DEFAULT_MARKETPLACE_ID = 'A2Q3Y263D00KWC'
const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token'
const ALLOWED_ENDPOINTS = new Set([
  'https://sellingpartnerapi-na.amazon.com',
  'https://sellingpartnerapi-eu.amazon.com',
  'https://sellingpartnerapi-fe.amazon.com',
])

export class AmazonSpApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 500
  ) {
    super(message)
    this.name = 'AmazonSpApiError'
  }
}

function env(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ''
}

export function amazonSpApiConfigState() {
  const applicationId = env(
    'AMAZON_SP_API_APPLICATION_ID',
    'ID_do_aplicativo_API_SP_AMAZON',
    'ID_do_Aplicativo_API_SP_AMAZON'
  )
  const clientId = env(
    'AMAZON_SP_API_CLIENT_ID',
    'ID_do_cliente_API_SP_AMAZON',
    'ID_do_Cliente_API_SP_AMAZON'
  )
  const clientSecret = env('AMAZON_SP_API_CLIENT_SECRET')
  const refreshToken = env('AMAZON_SP_API_REFRESH_TOKEN')
  const sellerId = env(
    'AMAZON_SP_API_SELLER_ID',
    'ID_do_Vendedor_API_SP_AMAZON',
    'ID_do_vendedor_API_SP_AMAZON'
  )
  const marketplaceId =
    env(
      'AMAZON_SP_API_MARKETPLACE_ID',
      'ID_do_Mercado_da_API_AMAZON_SP',
      'ID do Mercado da API AMAZON_SP',
      'ID do Mercado da API AMAZON SP'
    ) || DEFAULT_MARKETPLACE_ID
  const endpoint = env('AMAZON_SP_API_ENDPOINT') || DEFAULT_ENDPOINT
  const encryptionKey = env('AMAZON_TOKEN_ENCRYPTION_KEY')

  const missing = [
    !clientId && 'AMAZON_SP_API_CLIENT_ID',
    !clientSecret && 'AMAZON_SP_API_CLIENT_SECRET',
    !refreshToken && 'AMAZON_SP_API_REFRESH_TOKEN',
    !sellerId && 'AMAZON_SP_API_SELLER_ID',
  ].filter(Boolean) as string[]

  const applicationIdUsedAsClientId =
    /^amzn1\.sp\.solution\./i.test(clientId)

  return {
    configured:
      missing.length === 0 &&
      ALLOWED_ENDPOINTS.has(endpoint) &&
      !applicationIdUsedAsClientId,
    missing,
    applicationId: applicationId || null,
    applicationIdUsedAsClientId,
    clientIdConfigured: Boolean(clientId),
    clientSecretConfigured: Boolean(clientSecret),
    refreshTokenConfigured: Boolean(refreshToken),
    sellerIdConfigured: Boolean(sellerId),
    encryptionKeyConfigured: Boolean(encryptionKey),
    sellerId: sellerId || null,
    marketplaceId,
    endpoint,
  }
}

export function amazonSpApiConfig() {
  const state = amazonSpApiConfigState()
  if (!state.configured) {
    if (state.applicationIdUsedAsClientId) {
      throw new AmazonSpApiError(
        'application_id_as_client_id',
        'O ID do aplicativo Amazon (amzn1.sp.solution...) foi colocado no campo de Client ID. Use o LWA Client ID exibido em LWA credentials.',
        503
      )
    }

    throw new AmazonSpApiError(
      'configuration_incomplete',
      state.missing.length
        ? `Configuração Amazon incompleta: ${state.missing.join(', ')}`
        : 'Endpoint Amazon SP-API inválido.',
      503
    )
  }

  return {
    clientId: env(
      'AMAZON_SP_API_CLIENT_ID',
      'ID_do_cliente_API_SP_AMAZON',
      'ID_do_Cliente_API_SP_AMAZON'
    ),
    clientSecret: env('AMAZON_SP_API_CLIENT_SECRET'),
    refreshToken: env('AMAZON_SP_API_REFRESH_TOKEN'),
    sellerId: state.sellerId!,
    marketplaceId: state.marketplaceId,
    endpoint: state.endpoint,
  }
}

let tokenCache:
  | { token: string; expiresAt: number; fingerprint: string }
  | null = null

function credentialFingerprint(clientId: string, refreshToken: string) {
  return createHash('sha256')
    .update(clientId)
    .update('\0')
    .update(refreshToken)
    .digest('hex')
}

function mapLwaError(code?: string) {
  if (code === 'invalid_client') {
    return new AmazonSpApiError(
      'invalid_client',
      'A Amazon rejeitou o LWA Client ID/Client Secret. Confirme em LWA credentials que os dois pertencem à mesma aplicação e ao mesmo ambiente (produção ou sandbox).',
      401
    )
  }
  if (code === 'invalid_grant') {
    return new AmazonSpApiError(
      'invalid_grant',
      'Refresh Token da Amazon inválido, expirado ou revogado.',
      401
    )
  }
  return new AmazonSpApiError(
    'lwa_auth_failed',
    'A Amazon recusou a autenticação LWA.',
    502
  )
}

export async function amazonAccessToken() {
  const config = amazonSpApiConfig()
  const fingerprint = credentialFingerprint(
    config.clientId,
    config.refreshToken
  )

  if (
    tokenCache &&
    tokenCache.fingerprint === fingerprint &&
    tokenCache.expiresAt > Date.now() + 60_000
  ) {
    return tokenCache.token
  }

  const response = await fetch(LWA_TOKEN_URL, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | {
        access_token?: string
        expires_in?: number
        error?: string
      }
    | null

  if (!response.ok || !payload?.access_token) {
    throw mapLwaError(payload?.error)
  }

  const expiresIn = Number(payload.expires_in || 3600)
  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
    fingerprint,
  }

  return payload.access_token
}

function amazonDate() {
  return new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function safeAmazonMessage(value: unknown) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/Atzr\|[A-Za-z0-9._~+\/-]+/gi, '[token oculto]')
    .replace(/amzn1\.oa2-cs\.[A-Za-z0-9._~+\/-]+/gi, '[secret oculto]')
    .slice(0, 500)
}

function safeSpApiError(
  status: number,
  payload?: {
    errors?: Array<{ code?: string; message?: string; details?: string }>
  } | null
) {
  const amazonError = payload?.errors?.[0]
  const amazonCode = safeAmazonMessage(amazonError?.code)
  const amazonMessage = safeAmazonMessage(amazonError?.message)
  const detail = [amazonCode, amazonMessage].filter(Boolean).join(': ')

  if (status === 401) {
    return new AmazonSpApiError(
      'unauthorized',
      'Access Token Amazon inválido ou expirado.',
      401
    )
  }
  if (status === 403) {
    return new AmazonSpApiError(
      'forbidden',
      'A Amazon recusou esta operação. Para consultar listagens, a aplicação precisa de Inventário e rastreamento de pedidos ou Product Listing e deve ser autoautorizada novamente após qualquer alteração de função.',
      403
    )
  }
  if (status === 429) {
    return new AmazonSpApiError(
      'rate_limited',
      'A Amazon limitou temporariamente as consultas. Tente novamente em instantes.',
      429
    )
  }
  if (status === 400) {
    return new AmazonSpApiError(
      'bad_request',
      detail
        ? `A Amazon recusou a consulta: ${detail}`
        : 'A Amazon recusou a consulta (erro 400). Confira Seller ID/Merchant Token, Marketplace ID e os parâmetros da integração.',
      400
    )
  }

  return new AmazonSpApiError(
    `amazon_http_${status}`,
    detail
      ? `A Amazon SP-API respondeu com erro ${status}: ${detail}`
      : `A Amazon SP-API respondeu com erro ${status}.`,
    502
  )
}

async function amazonGet<T>(
  pathname: string,
  params: Record<string, string>
): Promise<T> {
  const config = amazonSpApiConfig()
  const token = await amazonAccessToken()
  const url = new URL(pathname, config.endpoint)

  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'x-amz-access-token': token,
      'x-amz-date': amazonDate(),
      'user-agent':
        'MatilhaPrado/1.0 (Language=TypeScript; Platform=Vercel)',
    },
  })

  const payload = (await response.json().catch(() => null)) as
    | T
    | {
        errors?: Array<{ code?: string; message?: string; details?: string }>
      }
    | null

  if (!response.ok) {
    throw safeSpApiError(
      response.status,
      payload as {
        errors?: Array<{ code?: string; message?: string; details?: string }>
      } | null
    )
  }

  return payload as T
}

type AmazonSummary = {
  marketplaceId?: string
  asin?: string
  productType?: string
  conditionType?: string
  status?: string[]
  itemName?: string
  mainImage?: { link?: string }
}

type AmazonOffer = {
  marketplaceId?: string
  offerType?: string
  price?: { amount?: number | string; currency?: string }
}

type AmazonAvailability = {
  fulfillmentChannelCode?: string
  quantity?: number
}

type AmazonRawItem = {
  sku?: string
  summaries?: AmazonSummary[]
  attributes?: Record<string, unknown>
  offers?: AmazonOffer[]
  fulfillmentAvailability?: AmazonAvailability[]
  productTypes?: Array<{ marketplaceId?: string; productType?: string }>
}

type AmazonSearchResponse = {
  numberOfResults?: number
  items?: AmazonRawItem[]
  pagination?: {
    nextToken?: string
    previousToken?: string
  }
}

export type AmazonCatalogItem = {
  sku: string
  asin: string | null
  title: string
  price: number | null
  currency: string
  quantity: number
  status: string[]
  imageUrl: string | null
  productType: string | null
}

function firstAttributeValue(
  attributes: Record<string, unknown> | undefined,
  key: string,
  field: string
) {
  const value = attributes?.[key]
  if (!Array.isArray(value) || !value.length) return null
  const first = value[0]
  if (!first || typeof first !== 'object') return null
  const result = (first as Record<string, unknown>)[field]
  return typeof result === 'string' ? result.trim() : null
}

function attributePrice(attributes: Record<string, unknown> | undefined) {
  const offers = attributes?.purchasable_offer
  if (!Array.isArray(offers) || !offers.length) return null

  const first = offers[0] as Record<string, unknown>
  const ourPrice = first?.our_price
  if (!Array.isArray(ourPrice) || !ourPrice.length) return null

  const schedule = (ourPrice[0] as Record<string, unknown>)?.schedule
  if (!Array.isArray(schedule) || !schedule.length) return null

  const raw = (schedule[0] as Record<string, unknown>)?.value_with_tax
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null
}

function validHttps(value?: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function normalizeAmazonItem(
  item: AmazonRawItem,
  marketplaceId: string
): AmazonCatalogItem | null {
  const sku = item.sku?.trim()
  if (!sku) return null

  const summary =
    item.summaries?.find((row) => row.marketplaceId === marketplaceId) ||
    item.summaries?.[0]

  const offer =
    item.offers?.find((row) => row.marketplaceId === marketplaceId) ||
    item.offers?.[0]

  const offerAmount = Number(offer?.price?.amount)
  const price = Number.isFinite(offerAmount)
    ? Math.max(0, offerAmount)
    : attributePrice(item.attributes)

  const quantity = (item.fulfillmentAvailability || []).reduce(
    (sum, row) =>
      sum +
      (Number.isFinite(Number(row.quantity))
        ? Math.max(0, Math.floor(Number(row.quantity)))
        : 0),
    0
  )

  const asin =
    summary?.asin?.trim() ||
    firstAttributeValue(item.attributes, 'merchant_suggested_asin', 'value')

  const image =
    validHttps(summary?.mainImage?.link) ||
    validHttps(
      firstAttributeValue(
        item.attributes,
        'main_product_image_locator',
        'media_location'
      )
    )

  return {
    sku,
    asin: asin || null,
    title:
      summary?.itemName?.trim() ||
      firstAttributeValue(item.attributes, 'item_name', 'value') ||
      sku,
    price,
    currency: offer?.price?.currency || 'BRL',
    quantity,
    status: Array.isArray(summary?.status) ? summary!.status! : [],
    imageUrl: image,
    productType:
      summary?.productType?.trim() ||
      item.productTypes?.[0]?.productType?.trim() ||
      null,
  }
}


type AmazonMarketplaceParticipationResponse = {
  payload?: Array<{
    marketplace?: {
      id?: string
      name?: string
      countryCode?: string
      domainName?: string
      defaultCurrencyCode?: string
      defaultLanguageCode?: string
    }
    participation?: {
      isParticipating?: boolean
      hasSuspendedListings?: boolean
    }
    storeName?: string
  }>
}

export async function amazonMarketplaceParticipations() {
  const payload = await amazonGet<AmazonMarketplaceParticipationResponse>(
    '/sellers/v1/marketplaceParticipations',
    {}
  )

  return (payload.payload || []).map((row) => ({
    id: row.marketplace?.id?.trim() || '',
    name: row.marketplace?.name?.trim() || '',
    countryCode: row.marketplace?.countryCode?.trim() || '',
    domainName: row.marketplace?.domainName?.trim() || '',
    currency: row.marketplace?.defaultCurrencyCode?.trim() || '',
    language: row.marketplace?.defaultLanguageCode?.trim() || '',
    storeName: row.storeName?.trim() || '',
    isParticipating: Boolean(row.participation?.isParticipating),
    hasSuspendedListings: Boolean(row.participation?.hasSuspendedListings),
  }))
}

export async function validateAmazonSellerContext() {
  const config = amazonSpApiConfig()
  const participations = await amazonMarketplaceParticipations()
  const configuredMarketplace = participations.find(
    (row) => row.id === config.marketplaceId
  )

  if (!configuredMarketplace) {
    const available = participations
      .filter((row) => row.id)
      .map((row) => `${row.countryCode || row.name || row.id} (${row.id})`)
      .join(', ')

    throw new AmazonSpApiError(
      'marketplace_not_authorized',
      available
        ? `O Marketplace ID configurado (${config.marketplaceId}) não pertence à conta Amazon autorizada. Marketplaces disponíveis: ${available}.`
        : 'A Amazon autenticou a aplicação, mas não retornou marketplaces vinculados à conta autorizada.',
      400
    )
  }

  return {
    marketplace: configuredMarketplace,
    participations,
  }
}

export async function amazonSellerListings(maximum = 500) {
  const config = amazonSpApiConfig()
  const collected: AmazonCatalogItem[] = []
  let nextToken = ''
  let includedData =
    'summaries,attributes,offers,fulfillmentAvailability,productTypes'

  do {
    const params = {
      marketplaceIds: config.marketplaceId,
      includedData,
      pageSize: '20',
      ...(nextToken ? { pageToken: nextToken } : {}),
    }

    let payload: AmazonSearchResponse

    try {
      payload = await amazonGet<AmazonSearchResponse>(
        `/listings/2021-08-01/items/${encodeURIComponent(config.sellerId)}`,
        params
      )
    } catch (error) {
      if (
        error instanceof AmazonSpApiError &&
        error.code === 'bad_request' &&
        !nextToken
      ) {
        try {
          includedData = 'summaries'
          payload = await amazonGet<AmazonSearchResponse>(
            `/listings/2021-08-01/items/${encodeURIComponent(config.sellerId)}`,
            {
              marketplaceIds: config.marketplaceId,
              includedData,
              pageSize: '10',
            }
          )
        } catch (minimalError) {
          if (
            minimalError instanceof AmazonSpApiError &&
            minimalError.code === 'bad_request'
          ) {
            throw new AmazonSpApiError(
              'invalid_seller_or_marketplace',
              'A autenticação Amazon está válida, mas até a consulta mínima de listagens foi recusada. Confira se AMAZON_SP_API_SELLER_ID contém exatamente o Merchant Token/Seller ID da mesma conta autoautorizada e se essa conta vende na Amazon Brasil.',
              400
            )
          }
          throw minimalError
        }
      } else {
        throw error
      }
    }

    for (const raw of payload.items || []) {
      const item = normalizeAmazonItem(raw, config.marketplaceId)
      if (item) collected.push(item)
      if (collected.length >= maximum) break
    }

    nextToken = payload.pagination?.nextToken || ''
  } while (nextToken && collected.length < maximum)

  return {
    items: collected.slice(0, maximum),
    total: collected.length,
    truncated: Boolean(nextToken),
    sellerId: config.sellerId,
    marketplaceId: config.marketplaceId,
    dataProfile:
      includedData === 'summaries' ? 'summaries' : 'full',
  }
}


export type AmazonMarketplaceOrder = {
  orderId: string
  purchaseDate: string
  lastUpdateDate: string
  status: string
  total: number
  buyerName: string | null
}

export type AmazonMarketplaceOrderItem = {
  asin: string | null
  sellerSku: string | null
  title: string | null
  quantity: number
  unitPrice: number
}

type AmazonOrdersApiResponse = {
  payload?: {
    Orders?: Array<{
      AmazonOrderId?: string
      PurchaseDate?: string
      LastUpdateDate?: string
      OrderStatus?: string
      OrderTotal?: { Amount?: string; CurrencyCode?: string }
      BuyerInfo?: { BuyerName?: string }
    }>
    NextToken?: string
  }
}

type AmazonOrderItemsApiResponse = {
  payload?: {
    OrderItems?: Array<{
      ASIN?: string
      SellerSKU?: string
      Title?: string
      QuantityOrdered?: number
      ItemPrice?: { Amount?: string; CurrencyCode?: string }
    }>
    NextToken?: string
  }
}

function amazonConfirmedOrderStatus(status?: string) {
  return ['Unshipped', 'PartiallyShipped', 'Shipped', 'InvoiceUnconfirmed'].includes(
    String(status || '')
  )
}

export async function amazonOrdersUpdatedSince(since: Date, maximum = 100) {
  const config = amazonSpApiConfig()
  const orders: AmazonMarketplaceOrder[] = []
  let nextToken = ''

  try {
    do {
      const payload = await amazonGet<AmazonOrdersApiResponse>(
        '/orders/v0/orders',
        nextToken
          ? {
              MarketplaceIds: config.marketplaceId,
              NextToken: nextToken,
            }
          : {
              MarketplaceIds: config.marketplaceId,
              LastUpdatedAfter: since.toISOString(),
              MaxResultsPerPage: '100',
            }
      )

      for (const order of payload.payload?.Orders || []) {
        if (!order.AmazonOrderId || !amazonConfirmedOrderStatus(order.OrderStatus)) {
          continue
        }
        orders.push({
          orderId: order.AmazonOrderId,
          purchaseDate: order.PurchaseDate || order.LastUpdateDate || new Date().toISOString(),
          lastUpdateDate: order.LastUpdateDate || order.PurchaseDate || new Date().toISOString(),
          status: order.OrderStatus || 'Unknown',
          total: Math.max(0, Number(order.OrderTotal?.Amount || 0)),
          buyerName: order.BuyerInfo?.BuyerName?.trim() || null,
        })
        if (orders.length >= maximum) break
      }

      nextToken = payload.payload?.NextToken || ''
    } while (nextToken && orders.length < maximum)
  } catch (error) {
    if (error instanceof AmazonSpApiError && error.status === 403) {
      throw new AmazonSpApiError(
        'orders_role_required',
        'A Amazon recusou a leitura de pedidos. Adicione à aplicação a função Inventory and Order Tracking (ou permissão equivalente de pedidos), autoautorize novamente a conta e atualize o Refresh Token.',
        403
      )
    }
    throw error
  }

  return {
    orders,
    truncated: Boolean(nextToken),
    sellerId: config.sellerId,
    marketplaceId: config.marketplaceId,
  }
}

export async function amazonOrderItems(orderId: string) {
  const items: AmazonMarketplaceOrderItem[] = []
  let nextToken = ''

  do {
    const payload = await amazonGet<AmazonOrderItemsApiResponse>(
      `/orders/v0/orders/${encodeURIComponent(orderId)}/orderItems`,
      nextToken ? { NextToken: nextToken } : {}
    )

    for (const item of payload.payload?.OrderItems || []) {
      const quantity = Math.max(1, Math.floor(Number(item.QuantityOrdered || 1)))
      const total = Math.max(0, Number(item.ItemPrice?.Amount || 0))
      items.push({
        asin: item.ASIN?.trim() || null,
        sellerSku: item.SellerSKU?.trim() || null,
        title: item.Title?.trim() || null,
        quantity,
        unitPrice: quantity > 0 ? total / quantity : total,
      })
    }

    nextToken = payload.payload?.NextToken || ''
  } while (nextToken)

  return items
}
