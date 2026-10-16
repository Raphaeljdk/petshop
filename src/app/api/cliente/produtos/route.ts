import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncZettaProductsToLocal } from '@/lib/zetta-products'
import { legacyProducts } from '@/lib/product-compat'
import { isServiceProduct, officialStockFromSources } from '@/lib/product-stock'

export const dynamic = 'force-dynamic'

type VariantProduct = {
  id: string
  nome: string
  categoria: string
  preco: number
  precoPromo: number | null
  estoque: number
  estoqueIlimitado?: boolean | null
  imageUrl: string | null
  descricao?: string | null
  zettaProCod?: number | null
  mlItemId?: string | null
  amazonAsin?: string | null
}

function normalizeVariantText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function variantSize(name: string) {
  const normalized = normalizeVariantText(name)
  const match = normalized.match(
    /(?:^|\s)(?:tamanho\s+|tam\s+)?(xxl|xgg|xl|xg|gg|pp|small|medium|large|xs|xx large|x large|p|m|g)$/
  )
  if (!match) return null
  const aliases: Record<string, string> = {
    xs: 'PP',
    small: 'P',
    medium: 'M',
    large: 'G',
    xl: 'GG',
    xg: 'GG',
    xgg: 'XGG',
    xxl: 'XGG',
    'x large': 'GG',
    'xx large': 'XGG',
  }
  return aliases[match[1]] || match[1].toUpperCase()
}

function variantBaseName(name: string) {
  return name
    .replace(
      /\s+(?:tamanhos?\s+|tam\.?\s*)?(?:XXL|XGG|XL|XG|GG|PP|XS|P|M|G)(?:\s*(?:,|\/|&|\be\b|\bou\b|-)\s*(?:XXL|XGG|XL|XG|GG|PP|XS|P|M|G)){1,}.*$/i,
      ''
    )
    .replace(
      /(?:[\s,(/-]+)(?:tamanho\s+|tam\.?\s*)?(?:XXL|XGG|XL|XG|GG|PP|SMALL|MEDIUM|LARGE|XS|XX[-\s]?LARGE|X[-\s]?LARGE|P|M|G)\)?\s*$/i,
      ''
    )
    .replace(/[\s,(/-]+$/, '')
    .trim()
}

function groupProductVariants<T extends VariantProduct>(products: T[]) {
  const groups = new Map<string, T[]>()
  const singles: T[] = []

  for (const product of products) {
    const size = variantSize(product.nome)
    if (!size) {
      singles.push(product)
      continue
    }
    const key = normalizeVariantText(variantBaseName(product.nome))
    const rows = groups.get(key) || []
    rows.push(product)
    groups.set(key, rows)
  }

  const grouped = [...singles]
  for (const rows of groups.values()) {
    if (rows.length < 2) {
      grouped.push(...rows)
      continue
    }

    const ordered = [...rows].sort((a, b) => {
      const aAvailable = a.estoqueIlimitado || a.estoque > 0
      const bAvailable = b.estoqueIlimitado || b.estoque > 0
      if (aAvailable !== bAvailable) return aAvailable ? -1 : 1
      return (a.precoPromo ?? a.preco) - (b.precoPromo ?? b.preco)
    })
    const primary = ordered[0]
    grouped.push({
      ...primary,
      nome: variantBaseName(primary.nome),
      estoque: ordered.reduce((total, variant) => total + Math.max(0, variant.estoque), 0),
      estoqueIlimitado: ordered.some((variant) => variant.estoqueIlimitado),
      variantes: ordered.map((variant) => ({
        ...variant,
        variacaoLabel: variantSize(variant.nome),
      })),
    } as T)
  }

  return grouped
}

function uniqueProducts<T extends { id: string }>(products: T[]) {
  return [...new Map(products.map((product) => [product.id, product])).values()]
}

export async function GET() {
  try {
    try {
      const official = await syncZettaProductsToLocal()
      const complementares = await db.produto.findMany({
        where: { ativo: true },
        orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
      })

      const produtos = groupProductVariants(uniqueProducts([...official.products, ...complementares])
        .map((produto) => ({
          ...produto,
          estoque: produto.estoqueIlimitado
            ? produto.estoque
            : officialStockFromSources(produto),
        }))
        .filter((produto) => !isServiceProduct(produto)))
        .sort((a, b) => {
          const aSemEstoque = !a.estoqueIlimitado && a.estoque <= 0
          const bSemEstoque = !b.estoqueIlimitado && b.estoque <= 0
          if (aSemEstoque !== bSemEstoque) return aSemEstoque ? 1 : -1
          return a.nome.localeCompare(b.nome, 'pt-BR')
        })

      return NextResponse.json(produtos)
    } catch (siggmaError) {
      console.error(
        '[cliente/produtos] API Siggma indisponível, usando cache local:',
        siggmaError
      )

      try {
        const cached = await db.produto.findMany({
          where: { ativo: true },
          orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
        })
        return NextResponse.json(
          groupProductVariants(cached
            .map((produto) => ({
              ...produto,
              estoque: produto.estoqueIlimitado
                ? produto.estoque
                : officialStockFromSources(produto),
            }))
            .filter((produto) => !isServiceProduct(produto)))
        .sort((a, b) => {
          const aSemEstoque = !a.estoqueIlimitado && a.estoque <= 0
          const bSemEstoque = !b.estoqueIlimitado && b.estoque <= 0
          if (aSemEstoque !== bSemEstoque) return aSemEstoque ? 1 : -1
          return a.nome.localeCompare(b.nome, 'pt-BR')
        })
        )
      } catch (schemaError) {
        console.warn(
          '[cliente/produtos] schema novo ainda não aplicado; usando leitura compatível:',
          schemaError instanceof Error ? schemaError.message : schemaError
        )
        return NextResponse.json(
          groupProductVariants((await legacyProducts({ onlyActive: true }))
            .filter((produto) => !isServiceProduct(produto)))
            .sort((a, b) => {
              const aSemEstoque = a.estoque <= 0
              const bSemEstoque = b.estoque <= 0
              if (aSemEstoque !== bSemEstoque) return aSemEstoque ? 1 : -1
              return a.nome.localeCompare(b.nome, 'pt-BR')
            })
        )
      }
    }
  } catch (error) {
    console.error('cliente/produtos GET erro:', error)
    return NextResponse.json({ error: 'Erro ao listar produtos' }, { status: 500 })
  }
}
