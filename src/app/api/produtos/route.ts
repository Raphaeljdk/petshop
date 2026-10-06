import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { isServiceProduct, isUnlimitedBathProduct, officialStockFromSources } from '@/lib/product-stock'


type ConsolidatableProduct = {
  id: string
  nome: string
  descricao: string | null
  categoria: string
  preco: number
  precoPromo: number | null
  estoque: number
  estoqueHub?: number | null
  estoqueZetta?: number | null
  estoqueMercadoLivre?: number | null
  estoqueAmazon?: number | null
  estoqueIlimitado?: boolean | null
  sku: string | null
  zettaProCod?: number | null
  mlItemId?: string | null
  amazonAsin?: string | null
  imageUrl: string | null
  ativo: boolean
  createdAt: Date
  updatedAt: Date
}

function normalizeProductMatch(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function compactProductMatch(value?: string | null) {
  return normalizeProductMatch(value).replace(/\s+/g, '')
}

function productMatchKeys(product: ConsolidatableProduct) {
  const keys: string[] = []

  if (product.zettaProCod != null) keys.push(`zetta:${product.zettaProCod}`)
  if (product.mlItemId) keys.push(`ml:${compactProductMatch(product.mlItemId)}`)
  if (product.amazonAsin) keys.push(`amazon:${compactProductMatch(product.amazonAsin)}`)

  const sku = compactProductMatch(product.sku)
  const marketplaceFallbackSku = /^ml[a-z]?\d+$/.test(sku)
  if (sku.length >= 3 && !marketplaceFallbackSku) {
    keys.push(`sku:${sku}`)
  }

  const nome = normalizeProductMatch(product.nome)
  if (nome.length >= 5 && nome !== 'produto sem titulo') {
    keys.push(`nome:${nome}`)
  }

  return keys
}

function consolidateAdminProducts<T extends ConsolidatableProduct>(products: T[]): T[] {
  if (products.length <= 1) {
    return products.map((product) => ({
      ...product,
      estoque: product.estoqueIlimitado
        ? product.estoque
        : officialStockFromSources(product),
    }))
  }

  const parent = products.map((_, index) => index)
  const find = (index: number): number => {
    if (parent[index] !== index) parent[index] = find(parent[index])
    return parent[index]
  }
  const union = (left: number, right: number) => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot
  }

  const ownerByKey = new Map<string, number>()
  products.forEach((product, index) => {
    for (const key of productMatchKeys(product)) {
      const owner = ownerByKey.get(key)
      if (owner == null) ownerByKey.set(key, index)
      else union(index, owner)
    }
  })

  const grouped = new Map<number, T[]>()
  products.forEach((product, index) => {
    const root = find(index)
    const current = grouped.get(root) || []
    current.push(product)
    grouped.set(root, current)
  })

  const score = (product: T) =>
    (product.zettaProCod != null ? 16 : 0) +
    (product.mlItemId ? 8 : 0) +
    (product.amazonAsin ? 4 : 0) +
    (product.sku ? 2 : 0) +
    (product.ativo ? 1 : 0)

  return Array.from(grouped.values()).map((rows) => {
    const primary = [...rows].sort((a, b) => score(b) - score(a))[0]

    const estoqueHub = Math.max(
      ...rows.map((row) => Math.max(0, Number(row.estoqueHub || 0)))
    )
    const estoqueZetta = Math.max(
      ...rows.map((row) => Math.max(0, Number(row.estoqueZetta || 0)))
    )
    const estoqueMercadoLivre = Math.max(
      ...rows.map((row) => Math.max(0, Number(row.estoqueMercadoLivre || 0)))
    )
    const estoqueAmazon = Math.max(
      ...rows.map((row) => Math.max(0, Number(row.estoqueAmazon || 0)))
    )
    const estoqueIlimitado = rows.some((row) => Boolean(row.estoqueIlimitado))

    const merged = {
      ...primary,
      estoqueHub,
      estoqueZetta,
      estoqueMercadoLivre,
      estoqueAmazon,
      estoqueIlimitado,
      zettaProCod:
        primary.zettaProCod ?? rows.find((row) => row.zettaProCod != null)?.zettaProCod ?? null,
      mlItemId: primary.mlItemId ?? rows.find((row) => row.mlItemId)?.mlItemId ?? null,
      amazonAsin:
        primary.amazonAsin ?? rows.find((row) => row.amazonAsin)?.amazonAsin ?? null,
      sku: primary.sku ?? rows.find((row) => row.sku)?.sku ?? null,
      imageUrl: primary.imageUrl ?? rows.find((row) => row.imageUrl)?.imageUrl ?? null,
      ativo: rows.some((row) => row.ativo),
    }

    return {
      ...merged,
      estoque: estoqueIlimitado ? primary.estoque : officialStockFromSources(merged),
    } as T
  })
}

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    try {
      const produtos = await db.produto.findMany({
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json(
        consolidateAdminProducts(produtos).filter((produto) => !isServiceProduct(produto))
      )
    } catch (prismaError) {
      console.warn(
        '[produtos GET] usando compatibilidade com schema anterior:',
        prismaError instanceof Error ? prismaError.message : prismaError
      )

      const legacy = await db.$queryRawUnsafe<Array<{
        id: string
        nome: string
        descricao: string | null
        categoria: string
        preco: number
        precoPromo: number | null
        estoque: number
        sku: string | null
        zettaProCod: number | null
        mlItemId: string | null
        amazonAsin: string | null
        imageUrl: string | null
        ativo: boolean
        createdAt: Date
        updatedAt: Date
      }>>(
        'SELECT "id","nome","descricao","categoria","preco","precoPromo","estoque","sku","zettaProCod","mlItemId","amazonAsin","imageUrl","ativo","createdAt","updatedAt" FROM "Produto" ORDER BY "createdAt" DESC'
      )

      const enriched = legacy.map((produto) => {
        const estoqueBase = Math.max(0, Number(produto.estoque || 0))
        const estoqueIlimitado = isUnlimitedBathProduct(produto)

        return {
          ...produto,
          estoqueHub:
            !produto.zettaProCod && !produto.mlItemId && !produto.amazonAsin
              ? estoqueBase
              : 0,
          estoqueZetta: produto.zettaProCod ? estoqueBase : 0,
          estoqueMercadoLivre:
            produto.mlItemId && !produto.zettaProCod ? estoqueBase : 0,
          estoqueAmazon:
            produto.amazonAsin && !produto.zettaProCod && !produto.mlItemId
              ? estoqueBase
              : 0,
          estoqueIlimitado,
          schemaCompatibilidade: true,
        }
      })

      return NextResponse.json(
        consolidateAdminProducts(enriched).filter((produto) => !isServiceProduct(produto))
      )
    }
  } catch (e) {
    console.error('produtos GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar produtos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await req.json()
    const {
      nome,
      descricao,
      categoria,
      preco,
      precoPromo,
      estoque,
      sku,
      mlItemId,
      amazonAsin,
      imageUrl,
      ativo,
    } = body

    if (!nome || !categoria || typeof preco !== 'number') {
      return NextResponse.json(
        { error: 'nome, categoria e preco são obrigatórios' },
        { status: 400 }
      )
    }

    const produto = await db.produto.create({
      data: {
        nome,
        descricao: descricao || null,
        categoria,
        preco,
        precoPromo: typeof precoPromo === 'number' ? precoPromo : null,
        estoque: typeof estoque === 'number' ? estoque : 0,
        estoqueHub: typeof estoque === 'number' ? estoque : 0,
        estoqueZetta: 0,
        estoqueMercadoLivre: 0,
        estoqueAmazon: 0,
        estoqueIlimitado: isUnlimitedBathProduct({ nome, categoria }),
        sku: sku || null,
        mlItemId: mlItemId || null,
        amazonAsin: amazonAsin || null,
        imageUrl: imageUrl || null,
        ativo: ativo !== undefined ? Boolean(ativo) : true,
      },
    })

    return NextResponse.json(produto, { status: 201 })
  } catch (e) {
    console.error('produtos POST erro:', e)
    return NextResponse.json({ error: 'Erro ao criar produto' }, { status: 500 })
  }
}
