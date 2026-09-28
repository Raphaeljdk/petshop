import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'
import {
  experienceBody,
  experienceError,
  paidSaleWhere,
  reviewInput,
} from '@/lib/customer-experience'

export async function GET() {
  try {
    const cliente = await getClienteLogado()
    if (!cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json(
      await db.productReview.findMany({
        where: { clienteId: cliente.id },
        take: 200,
      }),
    )
  } catch (error) {
    return experienceError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const cliente = await getClienteLogado()
    if (!cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { produtoId, rating, comment } = reviewInput.parse(
      await experienceBody(req),
    )
    const venda = await db.venda.findFirst({
      where: {
        ...paidSaleWhere,
        clienteId: cliente.id,
        itens: { some: { produtoId } },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (!venda)
      return NextResponse.json(
        {
          error:
            'Somente clientes com compra concluída deste produto podem avaliar.',
        },
        { status: 403 },
      )
    return NextResponse.json(
      await db.productReview.upsert({
        where: { clienteId_produtoId: { clienteId: cliente.id, produtoId } },
        create: {
          clienteId: cliente.id,
          produtoId,
          vendaId: venda.id,
          rating,
          comment,
        },
        update: { vendaId: venda.id, rating, comment },
      }),
    )
  } catch (error) {
    return experienceError(error)
  }
}
