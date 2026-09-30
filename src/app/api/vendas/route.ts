import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { emitWebSocket } from '@/lib/realtime'
import { officialStockFromSources } from '@/lib/product-stock'

const STATUS_VALIDOS = new Set(['concluida', 'pendente', 'cancelada'])
const CANAIS_VALIDOS = new Set(['loja', 'site', 'mercado_livre', 'amazon'])

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

    if (
      itens.some(
        (item) =>
          !item.produtoId ||
          !Number.isInteger(item.quantidade) ||
          item.quantidade <= 0
      )
    ) {
      return NextResponse.json(
        { error: 'Há itens inválidos na venda.' },
        { status: 400 }
      )
    }

    const statusFinal = status || 'concluida'
    if (!STATUS_VALIDOS.has(statusFinal)) {
      return NextResponse.json({ error: 'Status da venda inválido' }, { status: 400 })
    }

    const canalFinal = canal || 'loja'
    if (!CANAIS_VALIDOS.has(canalFinal)) {
      return NextResponse.json({ error: 'Canal da venda inválido' }, { status: 400 })
    }

    // O estoque é reservado em vendas pendentes/concluídas. Venda criada já
    // cancelada não deve alterar saldo.
    if (statusFinal !== 'cancelada') {
      for (const item of itens) {
        const produto = await db.produto.findUnique({ where: { id: item.produtoId } })
        if (!produto) {
          return NextResponse.json(
            { error: `Produto ${item.produtoId} não encontrado` },
            { status: 404 }
          )
        }

        if (produto.zettaProCod) {
          return NextResponse.json(
            {
              error:
                'Produtos vinculados ao Zetta devem ser vendidos pelo ERP enquanto o endpoint oficial de escrita não estiver integrado.',
            },
            { status: 409 }
          )
        }

        const estoqueDisponivel = officialStockFromSources(produto)
        if (!produto.estoqueIlimitado && estoqueDisponivel < item.quantidade) {
          return NextResponse.json(
            {
              error: `Estoque insuficiente para ${produto.nome}. Disponível: ${estoqueDisponivel}.`,
            },
            { status: 400 }
          )
        }
      }
    }

    const venda = await db.$transaction(async (tx) => {
      let total = 0
      const itensData: Array<{
        produtoId: string
        quantidade: number
        precoUnit: number
      }> = []

      for (const item of itens) {
        const produto = await tx.produto.findUnique({ where: { id: item.produtoId } })
        if (!produto) throw new Error('Produto não encontrado')

        if (produto.zettaProCod && statusFinal !== 'cancelada') {
          throw new Error(
            'Produto vinculado ao Zetta não pode ter o estoque alterado por esta rota.'
          )
        }

        const precoUnit = item.precoUnit ?? produto.precoPromo ?? produto.preco
        total += precoUnit * item.quantidade
        itensData.push({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnit,
        })

        if (statusFinal !== 'cancelada' && !produto.estoqueIlimitado) {
          const estoqueDisponivel = officialStockFromSources(produto)
          if (estoqueDisponivel < item.quantidade) {
            throw new Error(`Estoque insuficiente para ${produto.nome}`)
          }

          const usaHubComoFonte = produto.estoqueHub > 0

          await tx.produto.update({
            where: { id: item.produtoId },
            data: {
              estoque: estoqueDisponivel - item.quantidade,
              ...(usaHubComoFonte
                ? { estoqueHub: produto.estoqueHub - item.quantidade }
                : {}),
            },
          })
        }
      }

      return tx.venda.create({
        data: {
          clienteId: clienteId || null,
          total,
          subtotalProdutos: total,
          descontoCupom: 0,
          canal: canalFinal,
          status: statusFinal,
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
    })

    await emitWebSocket('venda:nova', {
      id: venda.id,
      total: venda.total,
      canal: venda.canal,
    })

    return NextResponse.json(venda, { status: 201 })
  } catch (e) {
    console.error('vendas POST erro:', e)
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Erro ao criar venda',
      },
      { status: 500 }
    )
  }
}
