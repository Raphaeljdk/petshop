import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { mercadoLivreAccessToken } from '@/lib/mercado-livre'
import {
  mercadoLivreCategoryNames,
  mercadoLivreItemsByIds,
  mercadoLivreSellerItemIds,
} from '@/lib/mercado-livre-items'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const { token, sellerId } = await mercadoLivreAccessToken()
    const search = await mercadoLivreSellerItemIds(sellerId, token)
    const items = await mercadoLivreItemsByIds(search.ids, token)
    const categories = await mercadoLivreCategoryNames(
      items.map((item) => item.categoryId),
      token
    )

    let created = 0
    let updated = 0

    for (const item of items) {
      const existing = await db.produto.findFirst({
        where: { mlItemId: item.id },
      })

      const data = {
        nome: item.title,
        categoria: item.categoryId
          ? categories.get(item.categoryId) || 'Mercado Livre'
          : 'Mercado Livre',
        preco: item.price,
        estoque: item.status === 'active' ? item.quantity : 0,
        sku: item.sku || item.id,
        mlItemId: item.id,
        imageUrl: item.thumbnail,
      }

      if (existing) {
        await db.produto.update({
          where: { id: existing.id },
          data,
        })
        updated += 1
      } else {
        await db.produto.create({
          data: {
            ...data,
            descricao: null,
            precoPromo: null,
            amazonAsin: null,
            ativo: false,
          },
        })
        created += 1
      }
    }

    return NextResponse.json({
      success: true,
      sellerId,
      totalMarketplace: search.total,
      synchronized: items.length,
      created,
      updated,
      newProductsHidden: created,
      truncated: search.truncated,
    })
  } catch (error) {
    console.error(
      'Mercado Livre sincronizar:',
      error instanceof Error ? error.message : 'falha'
    )

    return NextResponse.json(
      {
        error:
          'Não foi possível sincronizar o catálogo do Mercado Livre. Verifique a conexão e tente novamente.',
      },
      { status: 503 }
    )
  }
}
