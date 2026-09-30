import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncZettaProductsToLocal } from '@/lib/zetta-products'
import { legacyProducts } from '@/lib/product-compat'
import { officialStockFromSources } from '@/lib/product-stock'

export const dynamic = 'force-dynamic'

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

      const produtos = uniqueProducts([...official.products, ...complementares])
        .map((produto) => ({
          ...produto,
          estoque: produto.estoqueIlimitado
            ? produto.estoque
            : officialStockFromSources(produto),
        }))
        .filter((produto) => produto.estoqueIlimitado || produto.estoque > 0)

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
          cached
            .map((produto) => ({
              ...produto,
              estoque: produto.estoqueIlimitado
                ? produto.estoque
                : officialStockFromSources(produto),
            }))
            .filter((produto) => produto.estoqueIlimitado || produto.estoque > 0)
        )
      } catch (schemaError) {
        console.warn(
          '[cliente/produtos] schema novo ainda não aplicado; usando leitura compatível:',
          schemaError instanceof Error ? schemaError.message : schemaError
        )
        return NextResponse.json(
          await legacyProducts({ onlyActive: true })
        )
      }
    }
  } catch (error) {
    console.error('cliente/produtos GET erro:', error)
    return NextResponse.json({ error: 'Erro ao listar produtos' }, { status: 500 })
  }
}
