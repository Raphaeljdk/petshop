import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncZettaProductsToLocal } from '@/lib/zetta-products'
import { legacyProducts } from '@/lib/product-compat'

export const dynamic = 'force-dynamic'

function uniqueProducts<T extends { id: string }>(products: T[]) {
  return [...new Map(products.map((product) => [product.id, product])).values()]
}

export async function GET() {
  try {
    try {
      const official = await syncZettaProductsToLocal()
      const complementares = await db.produto.findMany({
        where: {
          ativo: true,
          OR: [{ estoque: { gt: 0 } }, { estoqueIlimitado: true }],
        },
        orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
      })

      return NextResponse.json(
        uniqueProducts([...official.products, ...complementares])
      )
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
        return NextResponse.json(cached)
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
