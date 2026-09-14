import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'

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
    const { status, observacoes, canal } = body

    const vendaExistente = await db.venda.findUnique({ where: { id } })
    if (!vendaExistente) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
    }

    const dados: any = {}
    if (status !== undefined) dados.status = status
    if (observacoes !== undefined) dados.observacoes = observacoes
    if (canal !== undefined) dados.canal = canal

    const venda = await db.venda.update({
      where: { id },
      data: dados,
      include: { cliente: true, itens: { include: { produto: true } } },
    })

    return NextResponse.json(venda)
  } catch (e) {
    console.error('venda PATCH erro:', e)
    return NextResponse.json({ error: 'Erro ao atualizar venda' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
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
    const vendaExistente = await db.venda.findUnique({
      where: { id },
      include: { itens: true },
    })
    if (!vendaExistente) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
    }

    // Restaura estoque
    await db.$transaction(async (tx) => {
      for (const item of vendaExistente.itens) {
        await tx.produto.update({
          where: { id: item.produtoId },
          data: { estoque: { increment: item.quantidade } },
        })
      }
      await tx.venda.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('venda DELETE erro:', e)
    return NextResponse.json({ error: 'Erro ao deletar venda' }, { status: 500 })
  }
}
