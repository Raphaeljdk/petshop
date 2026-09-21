import { integrationBridgeRequest } from '@/lib/integration-bridge'

export type ZettaProduct = {
  id: number
  codigo?: string | null
  nome: string
  preco?: number | string | null
  marca?: string | null
  modelo?: string | null
  unidade?: string | null
  codigoBarras?: string | null
  gtin?: string | null
  estoqueRealProduto?: number | string | null
  estoqueReal?: number | string | null
  galeria?: unknown
  dataAtualizacao?: string | null
  excluido?: boolean | null
}

type BridgePage<T> = {
  ok: boolean
  page: number
  limit: number
  total: number
  data: T[]
}

type BridgeOne<T> = {
  ok: boolean
  data: T
}

export function zettaProductPrice(product: ZettaProduct) {
  const value = Number(product.preco)
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function zettaProductStock(product: ZettaProduct) {
  const value = Number(product.estoqueReal)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

export function zettaProductSku(product: ZettaProduct) {
  return (
    product.codigo?.trim() ||
    product.gtin?.trim() ||
    product.codigoBarras?.trim() ||
    String(product.id)
  )
}

export async function getZettaProduct(proCod: number) {
  const result = await integrationBridgeRequest<BridgeOne<ZettaProduct>>(
    `/api/zetta/produtos/${encodeURIComponent(String(proCod))}`
  )
  return result.data
}

export async function getAllZettaProducts() {
  const first = await integrationBridgeRequest<BridgePage<ZettaProduct>>(
    '/api/zetta/produtos?page=1&limit=100'
  )

  const rows = [...(first.data || [])]
  const totalPages = Math.max(1, Math.ceil((first.total || rows.length) / 100))

  for (let page = 2; page <= totalPages; page += 1) {
    const current = await integrationBridgeRequest<BridgePage<ZettaProduct>>(
      `/api/zetta/produtos?page=${page}&limit=100`
    )
    rows.push(...(current.data || []))
  }

  return rows
}
