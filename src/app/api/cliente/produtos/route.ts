import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getAllZettaProducts,
  zettaProductPrice,
  zettaProductSku,
  zettaProductStock,
} from '@/lib/zetta-products'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const produtos = await db.produto.findMany({
      where: { ativo: true },
      orderBy: { createdAt: 'desc' },
    })

    const hasZettaProducts = produtos.some((produto) => produto.zettaProCod)
    if (!hasZettaProducts) {
      return NextResponse.json(produtos.filter((produto) => produto.estoque > 0))
    }

    try {
      const zettaProducts = await getAllZettaProducts()
      const byId = new Map(
        zettaProducts.map((product) => [Number(product.id), product] as const)
      )

      const catalogo = produtos
        .map((produto) => {
          if (!produto.zettaProCod) return produto

          const official = byId.get(produto.zettaProCod)
          if (!official || official.excluido) {
            return { ...produto, ativo: false, estoque: 0 }
          }

          return {
            ...produto,
            nome: official.nome || produto.nome,
            preco: zettaProductPrice(official),
            precoPromo: null,
            estoque: zettaProductStock(official),
            sku: zettaProductSku(official),
          }
        })
        .filter((produto) => produto.ativo && produto.estoque > 0 && produto.preco > 0)

      return NextResponse.json(catalogo)
    } catch (bridgeError) {
      console.error('[cliente/produtos] bridge Zetta indisponível:', bridgeError)

      // Fallback somente no cache local já sincronizado. O checkout sempre
      // revalida estoque/preço no ERP antes de criar a venda.
      return NextResponse.json(
        produtos.filter((produto) => produto.estoque > 0 && produto.preco > 0)
      )
    }
  } catch (e) {
    console.error('cliente/produtos GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar produtos' }, { status: 500 })
  }
}
