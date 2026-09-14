import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'

export const dynamic = 'force-dynamic'

const STATUS_VALIDOS = ['pendente', 'enviada', 'entregue', 'cancelada']

/**
 * PATCH /api/vendas/[id]/entrega
 *
 * Atualiza status de entrega e/ou código de rastreio de uma venda.
 * Acesso exclusivo de ADMIN.
 *
 * Body:
 *  - statusEntrega?: 'pendente' | 'enviada' | 'entregue' | 'cancelada'
 *  - codigoRastreio?: string
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { statusEntrega, codigoRastreio } = body as {
      statusEntrega?: string
      codigoRastreio?: string
    }

    const venda = await db.venda.findUnique({ where: { id } })
    if (!venda) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
    }

    const dados: Record<string, unknown> = {}
    if (statusEntrega !== undefined) {
      if (!STATUS_VALIDOS.includes(statusEntrega)) {
        return NextResponse.json(
          { error: `statusEntrega inválido. Valores aceitos: ${STATUS_VALIDOS.join(', ')}` },
          { status: 400 }
        )
      }
      dados.statusEntrega = statusEntrega
    }
    if (codigoRastreio !== undefined) {
      const valor = String(codigoRastreio).trim()
      dados.codigoRastreio = valor || null
    }

    const atualizado = await db.venda.update({
      where: { id },
      data: dados,
      include: { cliente: true, itens: { include: { produto: true } } },
    })

    return NextResponse.json({
      ...atualizado,
      createdAt: atualizado.createdAt.toISOString(),
      updatedAt: atualizado.updatedAt.toISOString(),
      cliente: atualizado.cliente
        ? {
            ...atualizado.cliente,
            createdAt: atualizado.cliente.createdAt.toISOString(),
            updatedAt: atualizado.cliente.updatedAt.toISOString(),
          }
        : null,
    })
  } catch (e) {
    console.error('venda entrega PATCH erro:', e)
    return NextResponse.json({ error: 'Erro ao atualizar entrega' }, { status: 500 })
  }
}
