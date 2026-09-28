import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { experienceError, paidSaleWhere } from '@/lib/customer-experience'

export async function GET(req: NextRequest) {
  try {
    const produtoId = req.nextUrl.searchParams.get('produtoId')
    if (!produtoId || produtoId.length > 100)
      return NextResponse.json({ error: 'Produto inválido' }, { status: 400 })
    const where = { produtoId, hidden: false, venda: paidSaleWhere }
    const [summary, reviews] = await Promise.all([
      db.productReview.aggregate({
        where,
        _avg: { rating: true },
        _count: true,
      }),
      db.productReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          cliente: { select: { nome: true } },
        },
      }),
    ])
    return NextResponse.json({
      average: summary._avg.rating,
      count: summary._count,
      reviews: reviews.map(({ cliente, ...row }) => ({
        ...row,
        author: cliente.nome.trim().split(/\s+/)[0] || 'Cliente',
        verified: true,
      })),
    })
  } catch (error) {
    return experienceError(error)
  }
}
