import { db } from '@/lib/db'
import { siggma } from '@/lib/siggma/service'
import type { SiggmaCategoria, SiggmaProduto } from '@/lib/siggma/types'
import { isUnlimitedBathProduct, totalStockFromSources } from '@/lib/product-stock'

export type ZettaProduct = {
  id: number
  codigoIntegracao?: number | null
  codigo?: string | null
  nome: string
  complemento?: string | null
  observacao?: string | null
  preco?: number | string | null
  valorPromocao?: number | string | null
  marca?: string | null
  modelo?: string | null
  peso?: number | string | null
  altura?: number | string | null
  largura?: number | string | null
  comprimento?: number | string | null
  unidade?: string | null
  codigoBarras?: string | null
  gtin?: string | null
  estoqueRealProduto?: number | string | null
  estoqueReal?: number | string | null
  galeria?: string[]
  categorias?: number[]
  variacoes?: Array<Record<string, unknown>>
  dataAtualizacao?: string | null
  excluido?: boolean | null
  inativo?: boolean | null
}

function asBoolean(value: unknown) {
  return value === true || String(value).toLowerCase() === 'true'
}

function normalizeImageUrls(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false

      try {
        const url = new URL(item)
        return url.protocol === 'https:' || url.protocol === 'http:'
      } catch {
        return false
      }
    })
}

function normalizeProduct(product: SiggmaProduto): ZettaProduct {
  return {
    id: Number(product.pro_cod),
    codigoIntegracao:
      product.codigo_integracao == null ? null : Number(product.codigo_integracao),
    codigo: product.codigo || null,
    nome: product.nome || `Produto Siggma ${product.pro_cod}`,
    complemento: product.complemento || null,
    observacao: product.observacao || null,
    preco: product.preco ?? null,
    valorPromocao: product.valor_promocao ?? null,
    marca: product.marca || null,
    modelo: product.modelo || null,
    peso: product.peso ?? null,
    altura: product.altura ?? null,
    largura: product.largura ?? null,
    comprimento: product.comprimento ?? null,
    codigoBarras: product.gtin || product.codigo || null,
    gtin: product.gtin || null,
    estoqueRealProduto: product.estoque ?? null,
    estoqueReal: product.estoque ?? null,
    galeria: normalizeImageUrls(product.imagens),
    categorias: Array.isArray(product.categorias) ? product.categorias : [],
    variacoes: Array.isArray(product.variacoes) ? product.variacoes : [],
    excluido: asBoolean(product.excluido),
    inativo: asBoolean(product.inativar_itens),
  }
}

export function zettaProductBasePrice(product: ZettaProduct) {
  const value = Number(product.preco)
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function zettaProductPromoPrice(product: ZettaProduct) {
  const value = Number(product.valorPromocao)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function zettaProductPrice(product: ZettaProduct) {
  return zettaProductPromoPrice(product) ?? zettaProductBasePrice(product)
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
  const result = await siggma.produtos.buscar(proCod)
  if (!result) throw new Error('Produto não encontrado no Siggma.')
  return normalizeProduct(result)
}

export async function getAllZettaProducts() {
  const first = await siggma.produtos.listar({ pagina: 1, ativo: 'true' })
  const rows = [...(first.data || [])]
  const pages = Math.max(Number(first.metadata?.paginas || 1), 1)

  for (let page = 2; page <= pages; page += 1) {
    const current = await siggma.produtos.listar({ pagina: page, ativo: 'true' })
    rows.push(...(current.data || []))
  }

  return rows.map(normalizeProduct)
}

export async function getAllZettaCategories() {
  const first = await siggma.categorias.listar({ pagina: 1 })
  const rows = [...(first.data || [])]
  const pages = Math.max(Number(first.metadata?.paginas || 1), 1)

  for (let page = 2; page <= pages; page += 1) {
    const current = await siggma.categorias.listar({ pagina: page })
    rows.push(...(current.data || []))
  }

  return rows.filter(
    (category: SiggmaCategoria) =>
      !category.excluido &&
      String(category.status || '').toLowerCase() !== 'inativa'
  )
}

export async function syncZettaProductsToLocal() {
  const [products, categories] = await Promise.all([
    getAllZettaProducts(),
    getAllZettaCategories(),
  ])

  const categoryMap = new Map(
    categories.map((category) => [Number(category.id), category.nome || 'Pet Shop'])
  )

  const valid = products.filter(
    (product) =>
      Number.isFinite(product.id) &&
      product.id > 0 &&
      !product.excluido &&
      !product.inativo
  )

  const existingProducts = await db.produto.findMany({
    select: {
      id: true,
      sku: true,
      zettaProCod: true,
      mlItemId: true,
      amazonAsin: true,
      imageUrl: true,
      ativo: true,
      estoqueHub: true,
      estoqueZetta: true,
      estoqueMercadoLivre: true,
      estoqueAmazon: true,
      estoqueIlimitado: true,
    },
  })

  const byZettaId = new Map(
    existingProducts
      .filter((row) => row.zettaProCod != null)
      .map((row) => [Number(row.zettaProCod), row])
  )
  const bySku = new Map<string, typeof existingProducts>()
  for (const row of existingProducts) {
    const key = row.sku?.trim().toLowerCase()
    if (!key) continue
    const rows = bySku.get(key) || []
    rows.push(row)
    bySku.set(key, rows)
  }

  const claimedExistingIds = new Set<string>()
  let linkedExisting = 0

  const operations = valid.map((product) => {
    const categoryId = product.categorias?.[0]
    const categoria =
      (categoryId ? categoryMap.get(Number(categoryId)) : null) || 'Pet Shop'
    const precoBase = zettaProductBasePrice(product)
    const precoPromo = zettaProductPromoPrice(product)
    const imageUrl = product.galeria?.[0] || null
    const sku = zettaProductSku(product)
    const direct = byZettaId.get(product.id)
    const skuMatches = (bySku.get(sku.trim().toLowerCase()) || []).filter(
      (row) =>
        !claimedExistingIds.has(row.id) &&
        (row.zettaProCod == null || row.zettaProCod === product.id)
    )
    const existing = direct || (skuMatches.length === 1 ? skuMatches[0] : null)
    const estoqueZetta = zettaProductStock(product)
    const estoqueIlimitado = isUnlimitedBathProduct({
      nome: product.nome,
      categoria,
    })

    if (existing) {
      claimedExistingIds.add(existing.id)
      if (!direct && existing.zettaProCod == null) linkedExisting += 1

      const estoque = totalStockFromSources({
        estoqueHub: existing.estoqueHub,
        estoqueZetta,
        estoqueMercadoLivre: existing.estoqueMercadoLivre,
        estoqueAmazon: existing.estoqueAmazon,
      })

      return db.produto.update({
        where: { id: existing.id },
        data: {
          nome: product.nome,
          descricao: product.modelo || product.marca || null,
          categoria,
          preco: precoBase,
          precoPromo,
          estoque,
          estoqueZetta,
          estoqueIlimitado,
          sku,
          zettaProCod: product.id,
          ...(imageUrl ? { imageUrl } : {}),
          ativo: true,
        },
      })
    }

    return db.produto.create({
      data: {
        nome: product.nome,
        descricao: product.modelo || product.marca || null,
        categoria,
        preco: precoBase,
        precoPromo,
        estoque: estoqueZetta,
        estoqueHub: 0,
        estoqueZetta,
        estoqueMercadoLivre: 0,
        estoqueAmazon: 0,
        estoqueIlimitado,
        sku,
        zettaProCod: product.id,
        imageUrl,
        ativo: true,
      },
    })
  })

  if (operations.length > 0) {
    await db.$transaction(operations)
  }

  const zettaIds = valid.map((product) => product.id)
  const staleZetta = await db.produto.findMany({
    where: {
      zettaProCod: {
        not: null,
        ...(zettaIds.length > 0 ? { notIn: zettaIds } : {}),
      },
    },
  })

  if (staleZetta.length > 0) {
    await db.$transaction(
      staleZetta.map((row) =>
        db.produto.update({
          where: { id: row.id },
          data: {
            estoqueZetta: 0,
            estoque: totalStockFromSources({
              estoqueHub: row.estoqueHub,
              estoqueZetta: 0,
              estoqueMercadoLivre: row.estoqueMercadoLivre,
              estoqueAmazon: row.estoqueAmazon,
            }),
            ativo: row.mlItemId || row.amazonAsin ? row.ativo : false,
          },
        })
      )
    )
  }

  return {
    total: valid.length,
    categories: categories.length,
    linkedExisting,
    products: await db.produto.findMany({
      where: {
        ativo: true,
        zettaProCod: { not: null },
        OR: [{ estoque: { gt: 0 } }, { estoqueIlimitado: true }],
      },
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    }),
  }
}
