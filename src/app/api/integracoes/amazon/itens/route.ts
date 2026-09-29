import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { AmazonSpApiError, amazonSellerListings } from '@/lib/amazon-sp-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const page = Number(req.nextUrl.searchParams.get('page') || '1')
  if (!Number.isInteger(page) || page < 1 || page > 1000) {
    return NextResponse.json({ error: 'Página inválida' }, { status: 400 })
  }

  try {
    const catalog = await amazonSellerListings(500)
    const limit = 20
    const start = (page - 1) * limit
    const visible = catalog.items.slice(start, start + limit)
    const asins = visible
      .map((item) => item.asin)
      .filter((value): value is string => Boolean(value))

    const localProducts = asins.length
      ? await db.produto.findMany({
          where: { amazonAsin: { in: asins } },
          select: {
            id: true,
            amazonAsin: true,
            sku: true,
            ativo: true,
          },
        })
      : []

    const localByKey = new Map(
      localProducts.map((product) => [
        `${product.amazonAsin || ''}::${product.sku || ''}`,
        product,
      ])
    )

    return NextResponse.json(
      {
        items: visible.map((item) => {
          const local = item.asin
            ? localByKey.get(`${item.asin}::${item.sku}`)
            : undefined

          return {
            ...item,
            imported: Boolean(local),
            published: Boolean(local?.ativo),
            productId: local?.id || null,
          }
        }),
        page,
        total: catalog.total,
        truncated: catalog.truncated,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    const message =
      error instanceof AmazonSpApiError
        ? error.message
        : 'Não foi possível consultar o catálogo Amazon.'

    return NextResponse.json(
      { error: message },
      {
        status: error instanceof AmazonSpApiError ? error.status : 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  }
}
