import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { officialStockFromSources } from '@/lib/product-stock'

const STATUS_VALIDOS = new Set(['concluida', 'pendente', 'cancelada'])
const CANAIS_VALIDOS = new Set(['loja', 'site', 'mercado_livre', 'amazon'])

function deveRestaurarHub(produto: {
  estoqueHub: number
  mlItemId: string | null
  amazonAsin: string | null
}) {
  return (
    produto.estoqueHub > 0 ||
    (!produto.mlItemId && !produto.amazonAsin)
  )
}

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
    const { status, observacoes, canal } = body as {
      status?: string
      observacoes?: string | null
      canal?: string
    }

    if (status !== undefined && !STATUS_VALIDOS.has(status)) {
      return NextResponse.json({ error: 'Status da venda inválido' }, { status: 400 })
    }
    if (canal !== undefined && !CANAIS_VALIDOS.has(canal)) {
      return NextResponse.json({ error: 'Canal da venda inválido' }, { status: 400 })
    }

    const venda = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`venda-status:${id}`}))`

      const atual = await tx.venda.findUnique({
        where: { id },
        include: { itens: { include: { produto: true } } },
      })

      if (!atual) return null

      const statusAtual = String(atual.status)
      const proximoStatus = status ?? statusAtual
      const estavaReservando = statusAtual !== 'cancelada'
      const vaiReservar = proximoStatus !== 'cancelada'

      if (estavaReservando && !vaiReservar) {
        // Cancelar devolve apenas o que esta venda local reservou.
        for (const item of atual.itens) {
          const produto = item.produto
          if (!produto || produto.estoqueIlimitado || produto.zettaProCod) continue

          const restaurarHub = deveRestaurarHub(produto)
          await tx.produto.update({
            where: { id: item.produtoId },
            data: {
              estoque: { increment: item.quantidade },
              ...(restaurarHub
                ? { estoqueHub: { increment: item.quantidade } }
                : {}),
            },
          })
        }
      } else if (!estavaReservando && vaiReservar) {
        // Reabrir uma venda cancelada volta a reservar estoque.
        for (const item of atual.itens) {
          const produto = item.produto
          if (!produto || produto.estoqueIlimitado) continue
          if (produto.zettaProCod) {
            throw new Error(
              `A venda contém ${produto.nome}, controlado pelo Zetta. Reabra a venda pelo fluxo oficial do ERP.`
            )
          }

          const disponivel = officialStockFromSources(produto)
          if (disponivel < item.quantidade) {
            throw new Error(
              `Estoque insuficiente para reabrir a venda de ${produto.nome}. Disponível: ${disponivel}.`
            )
          }

          const usaHubComoFonte = produto.estoqueHub > 0
          await tx.produto.update({
            where: { id: item.produtoId },
            data: {
              estoque: disponivel - item.quantidade,
              ...(usaHubComoFonte
                ? { estoqueHub: produto.estoqueHub - item.quantidade }
                : {}),
            },
          })
        }
      }

      const dados: any = {}
      if (status !== undefined) dados.status = status
      if (observacoes !== undefined) dados.observacoes = observacoes
      if (canal !== undefined) dados.canal = canal

      return tx.venda.update({
        where: { id },
        data: dados,
        include: { cliente: true, itens: { include: { produto: true } } },
      })
    })

    if (!venda) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
    }

    return NextResponse.json(venda)
  } catch (e) {
    console.error('venda PATCH erro:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao atualizar venda' },
      { status: 500 }
    )
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

    const deleted = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`venda-delete:${id}`}))`

      const vendaExistente = await tx.venda.findUnique({
        where: { id },
        include: { itens: { include: { produto: true } } },
      })
      if (!vendaExistente) return false

      // Se a venda já estava cancelada, o estoque já foi devolvido. Não
      // restaura novamente ao excluir, evitando inflação de saldo.
      if (vendaExistente.status !== 'cancelada') {
        for (const item of vendaExistente.itens) {
          const produto = item.produto
          if (!produto || produto.estoqueIlimitado || produto.zettaProCod) continue

          const restaurarHub = deveRestaurarHub(produto)
          await tx.produto.update({
            where: { id: item.produtoId },
            data: {
              estoque: { increment: item.quantidade },
              ...(restaurarHub
                ? { estoqueHub: { increment: item.quantidade } }
                : {}),
            },
          })
        }
      }

      await tx.venda.delete({ where: { id } })
      return true
    })

    if (!deleted) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('venda DELETE erro:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao deletar venda' },
      { status: 500 }
    )
  }
}
