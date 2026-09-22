import { db } from '@/lib/db'
import { siggma } from '@/lib/siggma/service'
import type { SiggmaCategoria, SiggmaProduto } from '@/lib/siggma/types'

export type ZettaProduct = {
  id: number
  codigoIntegracao?: number | null
  codigo?: string | null
  nome: string
  preco?: number | string | null
  valorPromocao?: number | string | null
  marca?: string | null
  modelo?: string | null
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

function normalizeProduct(product: SiggmaProduto): ZettaProduct {
  return {
    id: Number(product.pro_cod),
    codigoIntegracao:
      product.codigo_integracao == null ? null : Number(product.codigo_integracao),
    codigo: product.codigo || null,
    nome: product.nome || `Produto Siggma ${product.pro_cod}`,
    preco: product.preco ?? null,
    valorPromocao: product.valor_promocao ?? null,
    marca: product.marca || null,
    modelo: product.modelo || null,
    codigoBarras: product.gtin || product.codigo || null,
    gtin: product.gtin || null,
    estoqueRealProduto: product.estoque ?? null,
    estoqueReal: product.estoque ?? null,
    galeria: Array.isArray(product.imagens) ? product.imagens : [],
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

  const operations = valid.map((product) => {
    const categoryId = product.categorias?.[0]
    const categoria =
      (categoryId ? categoryMap.get(Number(categoryId)) : null) || 'Pet Shop'
    const precoBase = zettaProductBasePrice(product)
    const precoPromo = zettaProductPromoPrice(product)

    return db.produto.upsert({
      where: { zettaProCod: product.id },
      create: {
        nome: product.nome,
        descricao: product.modelo || product.marca || null,
        categoria,
        preco: precoBase,
        precoPromo,
        estoque: zettaProductStock(product),
        sku: zettaProductSku(product),
        zettaProCod: product.id,
        imageUrl: product.galeria?.[0] || null,
        ativo: true,
      },
      update: {
        nome: product.nome,
        descricao: product.modelo || product.marca || null,
        categoria,
        preco: precoBase,
        precoPromo,
        estoque: zettaProductStock(product),
        sku: zettaProductSku(product),
        imageUrl: product.galeria?.[0] || null,
        ativo: true,
      },
    })
  })

  if (operations.length > 0) {
    await db.$transaction(operations)
  }

  const zettaIds = valid.map((product) => product.id)
  await db.produto.updateMany({
    where: {
      zettaProCod: {
        not: null,
        ...(zettaIds.length > 0 ? { notIn: zettaIds } : {}),
      },
    },
    data: { ativo: false, estoque: 0 },
  })

  return {
    total: valid.length,
    categories: categories.length,
    products: await db.produto.findMany({
      where: { ativo: true, zettaProCod: { not: null }, estoque: { gt: 0 } },
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    }),
  }
}
