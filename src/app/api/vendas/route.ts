import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { emitWebSocket } from '@/lib/realtime'

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const vendas = await db.venda.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        cliente: true,
        itens: { include: { produto: true } },
      },
    })

    return NextResponse.json(vendas)
  } catch (e) {
    console.error('vendas GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar vendas' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await req.json()
    const { clienteId, itens, canal, observacoes, status } = body as {
      clienteId?: string | null
      itens: Array<{ produtoId: string; quantidade: number; precoUnit?: number }>
      canal?: string
      observacoes?: string
      status?: string
    }

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json(
        { error: 'Itens da venda são obrigatórios' },
        { status: 400 }
      )
    }

    // valida estoque
    for (const item of itens) {
      const produto = await db.produto.findUnique({ where: { id: item.produtoId } })
      if (!produto) {
        return NextResponse.json(
          { error: `Produto ${item.produtoId} não encontrado` },
          { status: 404 }
        )
      }
      if (produto.estoque < item.quantidade) {
        return NextResponse.json(
          { error: `Estoque insuficiente para ${produto.nome}` },
          { status: 400 }
        )
      }
    }

    const venda = await db.$transaction(async (tx) => {
      let total = 0
      const itensData: Array<{ produtoId: string; quantidade: number; precoUnit: number }> = []

      for (const item of itens) {
        const produto = await tx.produto.findUnique({ where: { id: item.produtoId } })
        if (!produto) throw new Error('Produto não encontrado')
        const precoUnit = item.precoUnit ?? produto.precoPromo ?? produto.preco
        total += precoUnit * item.quantidade
        itensData.push({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnit,
        })

        await tx.produto.update({
          where: { id: item.produtoId },
          data: { estoque: { decrement: item.quantidade } },
        })
      }

      const novaVenda = await tx.venda.create({
        data: {
          clienteId: clienteId || null,
          total,
          canal: canal || 'loja',
          status: status || 'concluida',
          observacoes: observacoes || null,
          itens: {
            create: itensData,
          },
        },
        include: {
          cliente: true,
          itens: { include: { produto: true } },
        },
      })

      return novaVenda
    })

    await emitWebSocket('venda:nova', {
      id: venda.id,
      total: venda.total,
      canal: venda.canal,
    })

    return NextResponse.json(venda, { status: 201 })
  } catch (e) {
    console.error('vendas POST erro:', e)
    return NextResponse.json({ error: 'Erro ao criar venda' }, { status: 500 })
  }
}
