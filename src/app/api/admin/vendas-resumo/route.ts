import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/auth-helpers'
import { experienceError, paidSaleWhere } from '@/lib/customer-experience'

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdmin()))
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    const days = req.nextUrl.searchParams.get('days') === '7' ? 7 : 30
    const since = new Date(Date.now() - days * 86400000)
    const where = { ...paidSaleWhere, createdAt: { gte: since } }
    const [summary, top, lowStock] = await Promise.all([
      db.venda.aggregate({
        where,
        _sum: { total: true, valorFrete: true },
        _count: true,
      }),
      db.itemVenda.groupBy({
        by: ['produtoId'],
        where: { venda: where },
        _sum: { quantidade: true },
        orderBy: { _sum: { quantidade: 'desc' } },
        take: 8,
      }),
      db.produto.findMany({
        where: { ativo: true, estoque: { lte: 5 } },
        orderBy: { estoque: 'asc' },
        take: 12,
        select: {
          id: true,
          nome: true,
          estoque: true,
          updatedAt: true,
          zettaProCod: true,
        },
      }),
    ])
    const products = await db.produto.findMany({
      where: { id: { in: top.map((row) => row.produtoId) } },
      select: { id: true, nome: true },
    })
    const revenue = (summary._sum.total || 0) - (summary._sum.valorFrete || 0)
    return NextResponse.json({
      days,
      orders: summary._count,
      revenue,
      average: summary._count ? revenue / summary._count : 0,
      top: top.map((row) => ({
        id: row.produtoId,
        name:
          products.find((p) => p.id === row.produtoId)?.nome ||
          'Produto removido',
        quantity: row._sum.quantidade || 0,
      })),
      lowStock,
    })
  } catch (error) {
    return experienceError(error)
  }
}
