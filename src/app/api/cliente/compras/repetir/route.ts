import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'
import { experienceError } from '@/lib/customer-experience'
import {
  getZettaProduct,
  zettaProductPrice,
  zettaProductStock,
} from '@/lib/zetta-products'

export async function GET(req: NextRequest) {
  try {
    const cliente = await getClienteLogado()
    if (!cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const id = req.nextUrl.searchParams.get('id') || ''
    const sale = await db.venda.findFirst({
      where: { id, clienteId: cliente.id },
      include: { itens: { include: { produto: true } } },
    })
    if (!sale)
      return NextResponse.json(
        { error: 'Compra não encontrada' },
        { status: 404 },
      )
    const grouped = new Map<
      string,
      { produto: (typeof sale.itens)[number]['produto']; quantidade: number }
    >()
    for (const item of sale.itens) {
      const previous = grouped.get(item.produtoId)
      grouped.set(item.produtoId, {
        produto: item.produto,
        quantidade: (previous?.quantidade || 0) + item.quantidade,
      })
    }
    const results = await Promise.all(
      [...grouped.values()].map(async ({ produto, quantidade }) => {
        if (!produto.ativo) return { skipped: `${produto.nome}: indisponível.` }
        let current = produto
        if (produto.zettaProCod) {
          try {
            const official = await getZettaProduct(produto.zettaProCod)
            if (official.excluido || official.inativo)
              return { skipped: `${produto.nome}: indisponível.` }
            current = {
              ...produto,
              preco: zettaProductPrice(official),
              precoPromo: null,
              estoque: zettaProductStock(official),
            }
          } catch {
            return {
              skipped: `${produto.nome}: estoque não confirmado no momento.`,
            }
          }
        }
        const qty = Math.min(quantidade, current.estoque)
        if (qty <= 0 || (current.precoPromo ?? current.preco) <= 0)
          return { skipped: `${produto.nome}: indisponível.` }
        return {
          item: { produto: current, quantidade: qty },
          skipped:
            qty < quantidade
              ? `${produto.nome}: quantidade ajustada para ${qty}.`
              : null,
        }
      }),
    )
    return NextResponse.json(
      {
        items: results.flatMap((row) => (row.item ? [row.item] : [])),
        notices: results.flatMap((row) => (row.skipped ? [row.skipped] : [])),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return experienceError(error)
  }
}
