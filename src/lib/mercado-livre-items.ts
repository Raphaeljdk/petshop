import 'server-only'

type MercadoLivrePicture = {
  id?: string
  url?: string
  secure_url?: string
}

type MercadoLivreAttribute = {
  id?: string
  value_name?: string | null
}

type MercadoLivreItemBody = {
  id?: string
  title?: string
  price?: number
  currency_id?: string
  available_quantity?: number
  status?: string
  permalink?: string
  thumbnail?: string
  secure_thumbnail?: string
  category_id?: string
  seller_custom_field?: string | null
  pictures?: MercadoLivrePicture[]
  attributes?: MercadoLivreAttribute[]
}

type MercadoLivreBulkResult = {
  id?: string
  status_code?: number
  code?: number
  body?: MercadoLivreItemBody
}

export type MercadoLivreCatalogItem = {
  id: string
  title: string
  price: number
  currency: string
  quantity: number
  status: string
  permalink: string | null
  thumbnail: string | null
  images: string[]
  categoryId: string | null
  sku: string
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

function chunks<T>(items: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

function sellerSku(body: MercadoLivreItemBody) {
  const fromAttribute = body.attributes?.find(
    (attribute) => attribute.id === 'SELLER_SKU' && attribute.value_name
  )?.value_name

  return body.seller_custom_field?.trim() || fromAttribute?.trim() || body.id || ''
}

function normalizeBulkItem(result: MercadoLivreBulkResult): MercadoLivreCatalogItem | null {
  const body = result.body
  const statusCode = result.status_code ?? result.code
  const itemId = body?.id || result.id

  if (statusCode !== 200 || !body || !itemId) return null

  // /items/bulk returns the item id at the root of each verbose result.
  // Keep body.id as a fallback for the legacy multiget response while both
  // formats coexist during Mercado Livre's migration.
  const normalizedBody: MercadoLivreItemBody = body.id
    ? body
    : { ...body, id: itemId }

  const images = (normalizedBody.pictures || [])
    .map((picture) => validHttps(picture.secure_url) || validHttps(picture.url))
    .filter((value): value is string => Boolean(value))

  const thumbnail =
    images[0] ||
    validHttps(normalizedBody.secure_thumbnail) ||
    validHttps(normalizedBody.thumbnail)

  return {
    id: itemId,
    title: normalizedBody.title?.trim() || 'Produto sem título',
    price: Number.isFinite(Number(normalizedBody.price))
      ? Math.max(0, Number(normalizedBody.price))
      : 0,
    currency: normalizedBody.currency_id || 'BRL',
    quantity: Number.isFinite(Number(normalizedBody.available_quantity))
      ? Math.max(0, Math.floor(Number(normalizedBody.available_quantity)))
      : 0,
    status: normalizedBody.status || 'unknown',
    permalink: validHttps(normalizedBody.permalink),
    thumbnail,
    images,
    categoryId: normalizedBody.category_id || null,
    sku: sellerSku(normalizedBody),
  }
}

export async function mercadoLivreSellerItemIds(
  sellerId: string,
  token: string,
  maximum = 1000
) {
  const ids: string[] = []
  const limit = 50
  let offset = 0
  let total = 0

  do {
    const url = new URL(
      `https://api.mercadolibre.com/users/${encodeURIComponent(sellerId)}/items/search`
    )
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Busca de anúncios falhou (${response.status})`)
    }

    const payload = (await response.json()) as {
      results?: string[]
      paging?: { total?: number }
    }

    const pageIds = (payload.results || []).filter((id) => /^ML[A-Z]\d+$/.test(id))
    ids.push(...pageIds)

    total = Math.max(0, Number(payload.paging?.total || 0))
    offset += limit
  } while (offset < total && ids.length < maximum)

  return {
    ids: ids.slice(0, maximum),
    total,
    truncated: total > maximum,
  }
}

export async function mercadoLivreItemsByIds(ids: string[], token: string) {
  const uniqueIds = [...new Set(ids.filter((id) => /^ML[A-Z]\d+$/.test(id)))]
  const items: MercadoLivreCatalogItem[] = []

  for (const group of chunks(uniqueIds, 20)) {
    const url = new URL('https://api.mercadolibre.com/items/bulk')
    url.searchParams.set('ids', group.join(','))
    url.searchParams.set(
      'attributes',
      [
        'body.id',
        'body.title',
        'body.price',
        'body.currency_id',
        'body.available_quantity',
        'body.status',
        'body.permalink',
        'body.thumbnail',
        'body.secure_thumbnail',
        'body.category_id',
        'body.seller_custom_field',
        'body.pictures',
        'body.attributes',
      ].join(',')
    )

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Detalhes dos anúncios falharam (${response.status})`)
    }

    const payload = (await response.json()) as MercadoLivreBulkResult[]
    items.push(
      ...payload
        .map(normalizeBulkItem)
        .filter((item): item is MercadoLivreCatalogItem => item !== null)
    )
  }

  return items
}

export async function mercadoLivreCategoryNames(
  categoryIds: Array<string | null>,
  token: string
) {
  const uniqueIds = [...new Set(categoryIds.filter((id): id is string => Boolean(id)))]
  const entries = await Promise.all(
    uniqueIds.map(async (categoryId) => {
      try {
        const response = await fetch(
          `https://api.mercadolibre.com/categories/${encodeURIComponent(categoryId)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }
        )

        if (!response.ok) return [categoryId, 'Mercado Livre'] as const
        const payload = (await response.json()) as { name?: string }
        return [categoryId, payload.name?.trim() || 'Mercado Livre'] as const
      } catch {
        return [categoryId, 'Mercado Livre'] as const
      }
    })
  )

  return new Map(entries)
}

export async function mercadoLivreItemDetails(itemId: string, token: string) {
  const [itemResponse, descriptionResponse] = await Promise.all([
    fetch(
      `https://api.mercadolibre.com/items/${encodeURIComponent(itemId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    ),
    fetch(
      `https://api.mercadolibre.com/items/${encodeURIComponent(itemId)}/description`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    ),
  ])

  if (!itemResponse.ok) {
    throw new Error(`Detalhes do anúncio falharam (${itemResponse.status})`)
  }

  const item = (await itemResponse.json()) as MercadoLivreItemBody
  const description = descriptionResponse.ok
    ? ((await descriptionResponse.json()) as { plain_text?: string })
    : null

  const normalized = normalizeBulkItem({
    status_code: 200,
    body: item,
  })

  if (!normalized) throw new Error('Anúncio do Mercado Livre inválido')

  return {
    ...normalized,
    description: description?.plain_text?.trim() || null,
  }
}
