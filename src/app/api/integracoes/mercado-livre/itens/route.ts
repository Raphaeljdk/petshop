import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { mercadoLivreAccessToken } from '@/lib/mercado-livre'
import { mercadoLivreItemsByIds } from '@/lib/mercado-livre-items'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const rawPage = Number(req.nextUrl.searchParams.get('page') || '1')
  if (!Number.isInteger(rawPage) || rawPage < 1 || rawPage > 1000) {
    return NextResponse.json({ error: 'Página inválida' }, { status: 400 })
  }

  const limit = 20

  try {
    const { token, sellerId } = await mercadoLivreAccessToken()
    const searchUrl = new URL(
      `https://api.mercadolibre.com/users/${encodeURIComponent(sellerId)}/items/search`
    )
    searchUrl.searchParams.set('limit', String(limit))
    searchUrl.searchParams.set('offset', String((rawPage - 1) * limit))

    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (!searchResponse.ok) {
      throw new Error(`Busca de anúncios falhou (${searchResponse.status})`)
    }

    const search = (await searchResponse.json()) as {
      results?: string[]
      paging?: { total?: number }
    }

    const ids = (search.results || [])
      .filter((id) => /^ML[A-Z]\d+$/.test(id))
      .slice(0, limit)

    if (!ids.length) {
      return NextResponse.json(
        {
          items: [],
          page: rawPage,
          total: search.paging?.total || 0,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const [items, localProducts] = await Promise.all([
      mercadoLivreItemsByIds(ids, token),
      db.produto.findMany({
        where: { mlItemId: { in: ids } },
        select: {
          id: true,
          mlItemId: true,
          ativo: true,
        },
      }),
    ])

    const localByMlId = new Map(
      localProducts
        .filter((product) => product.mlItemId)
        .map((product) => [product.mlItemId!, product])
    )

    return NextResponse.json(
      {
        items: items.map((item) => {
          const local = localByMlId.get(item.id)
          return {
            id: item.id,
            title: item.title,
            price: item.price,
            currency: item.currency,
            quantity: item.quantity,
            status: item.status,
            permalink: item.permalink,
            thumbnail: item.thumbnail,
            imported: Boolean(local),
            published: Boolean(local?.ativo),
            productId: local?.id || null,
          }
        }),
        page: rawPage,
        total: search.paging?.total || 0,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error(
      'Mercado Livre itens:',
      error instanceof Error ? error.message : 'falha'
    )

    return NextResponse.json(
      {
        error:
          'Não foi possível consultar os anúncios. Verifique a conexão do Mercado Livre.',
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  }
}
