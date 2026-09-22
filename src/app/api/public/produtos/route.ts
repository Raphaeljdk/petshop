import { unstable_cache } from 'next/cache'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncZettaProductsToLocal } from '@/lib/zetta-products'

const getPublicProducts = unstable_cache(
  async () => {
    try {
      const synced = await syncZettaProductsToLocal()
      return synced.products
    } catch (error) {
      console.error('[public/produtos] Siggma indisponível, usando cache local:', error)
      return db.produto.findMany({
        where: { ativo: true, estoque: { gt: 0 } },
        orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
      })
    }
  },
  ['public-products-v1'],
  { revalidate: 300 }
)

export async function GET() {
  try {
    const products = await getPublicProducts()

    return NextResponse.json(
      products.map((product) => ({
        id: product.id,
        nome: product.nome,
        descricao: product.descricao,
        categoria: product.categoria,
        preco: product.preco,
        precoPromo: product.precoPromo,
        estoque: product.estoque,
        imageUrl: product.imageUrl,
      })),
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('[public/produtos] erro:', error)
    return NextResponse.json({ error: 'Não foi possível carregar a vitrine.' }, { status: 500 })
  }
}
