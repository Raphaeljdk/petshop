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
      'A aplicação Amazon não tem acesso ao catálogo. Verifique a função Product Listing, a autoautorização e o Seller ID.',
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
  await validateAmazonSellerContext()
  const collected: AmazonCatalogItem[] = []
  let nextToken = ''

  do {
    let payload: AmazonSearchResponse
    try {
      payload = await amazonGet<AmazonSearchResponse>(
        `/listings/2021-08-01/items/${encodeURIComponent(config.sellerId)}`,
        {
        marketplaceIds: config.marketplaceId,
        includedData:
          'summaries,attributes,offers,fulfillmentAvailability,productTypes',
        pageSize: '20',
          ...(nextToken ? { pageToken: nextToken } : {}),
        }
      )
    } catch (error) {
      if (
        error instanceof AmazonSpApiError &&
        error.code === 'bad_request'
      ) {
        throw new AmazonSpApiError(
          'invalid_seller_or_listing_parameters',
          'A autenticação e o Marketplace ID foram validados pela Amazon, mas a Listings API recusou a consulta. Confira se AMAZON_SP_API_SELLER_ID contém exatamente o Merchant Token/Seller ID da mesma conta que foi autoautorizada.',
          400
        )
      }
      throw error
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
  }
}
