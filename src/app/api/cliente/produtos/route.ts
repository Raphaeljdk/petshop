import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncZettaProductsToLocal } from '@/lib/zetta-products'

export const dynamic = 'force-dynamic'

function uniqueProducts<T extends { id: string }>(products: T[]) {
  return [...new Map(products.map((product) => [product.id, product])).values()]
}

export async function GET() {
  try {
    try {
      const official = await syncZettaProductsToLocal()
      const mercadoLivre = await db.produto.findMany({
        where: {
          ativo: true,
          mlItemId: { not: null },
          estoque: { gt: 0 },
        },
        orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
      })

      return NextResponse.json(
        uniqueProducts([...official.products, ...mercadoLivre])
      )
    } catch (siggmaError) {
      console.error(
        '[cliente/produtos] API Siggma indisponível, usando cache local:',
        siggmaError
      )

      const cached = await db.produto.findMany({
        where: { ativo: true, estoque: { gt: 0 } },
        orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
      })

      return NextResponse.json(cached)
    }
  } catch (error) {
    console.error('cliente/produtos GET erro:', error)
    return NextResponse.json({ error: 'Erro ao listar produtos' }, { status: 500 })
  }
}
