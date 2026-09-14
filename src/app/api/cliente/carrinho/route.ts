import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'
import { getOpcaoFrete, normalizarCep, validarCep } from '@/lib/frete'
import { emitWebSocket } from '@/lib/realtime'

export async function POST(req: NextRequest) {
  try {
    const cliente = await getClienteLogado()
    if (!cliente) {
      return NextResponse.json(
        { error: 'Cliente não autenticado' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const {
      itens,
      observacoes,
      tipoEntrega,
      cepEntrega,
      enderecoEntrega,
    } = body as {
      itens: Array<{ produtoId: string; quantidade: number }>
      observacoes?: string
      tipoEntrega?: 'retirada' | 'entrega_propria' | 'sedex' | null
      cepEntrega?: string
      enderecoEntrega?: string
    }

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json(
        { error: 'Carrinho vazio' },
        { status: 400 }
      )
    }

    if (!tipoEntrega) {
      return NextResponse.json(
        { error: 'Selecione uma opção de entrega' },
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
      if (!produto.ativo || produto.estoque < item.quantidade) {
        return NextResponse.json(
          { error: `Estoque insuficiente para ${produto.nome}` },
          { status: 400 }
        )
      }
    }

    // ---------- Frete ----------
    // Tipos aceitos e valor correspondente confirmado no backend (nunca confiar no client)
    let valorFrete = 0
    let prazoEntrega: string | null = null
    let cepFinal: string | null = null
    let enderecoFinal: string | null = null

    const tipo = (tipoEntrega || '').toString()

    if (tipo === 'retirada') {
      // Sempre permitido (se a configuração estiver ativa)
      valorFrete = 0
      prazoEntrega = null
      cepFinal = null
      enderecoFinal = null
    } else if (tipo === 'entrega_propria' || tipo === 'sedex') {
      // Exige CEP válido
      if (!cepEntrega || !validarCep(cepEntrega)) {
        return NextResponse.json(
          { error: 'CEP de entrega inválido' },
          { status: 400 }
        )
      }
      const cepNormalizado = normalizarCep(cepEntrega)
      const opcao = await getOpcaoFrete(cepNormalizado, tipo)
      if (!opcao || !opcao.disponivel) {
        return NextResponse.json(
          {
            error:
              tipo === 'entrega_propria'
                ? 'Entrega própria não disponível para este CEP (fora da área de cobertura)'
                : 'Sedex indisponível no momento',
          },
          { status: 400 }
        )
      }
      valorFrete = opcao.valor
      prazoEntrega = opcao.prazo
      cepFinal = cepNormalizado
      enderecoFinal = enderecoEntrega?.trim() || cliente.endereco || null
    } else {
      return NextResponse.json(
        { error: 'Tipo de entrega inválido' },
        { status: 400 }
      )
    }

    // ---------- Venda ----------
    const venda = await db.$transaction(async (tx) => {
      let subtotal = 0
      const itensData: Array<{ produtoId: string; quantidade: number; precoUnit: number }> = []

      for (const item of itens) {
        const produto = await tx.produto.findUnique({ where: { id: item.produtoId } })
        if (!produto) throw new Error('Produto não encontrado')
        const precoUnit = produto.precoPromo ?? produto.preco
        subtotal += precoUnit * item.quantidade
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

      const total = subtotal + valorFrete

      const novaVenda = await tx.venda.create({
        data: {
          clienteId: cliente.id,
          total,
          canal: 'site',
          status: 'pendente', // Vai para 'concluida' após pagamento aprovado
          observacoes: observacoes || null,
          tipoEntrega: tipo,
          valorFrete,
          cepEntrega: cepFinal,
          enderecoEntrega: enderecoFinal,
          prazoEntrega,
          codigoRastreio: null,
          statusEntrega: tipo === 'retirada' ? 'entregue' : 'pendente',
          itens: { create: itensData },
        },
        include: { cliente: true, itens: { include: { produto: true } } },
      })

      return novaVenda
    })

    await emitWebSocket('venda:nova', {
      id: venda.id,
      total: venda.total,
      canal: venda.canal,
      clienteId: cliente.id,
    })

    // Serializa datas para o client
    return NextResponse.json(
      {
        ...venda,
        createdAt: venda.createdAt.toISOString(),
        updatedAt: venda.updatedAt.toISOString(),
        cliente: venda.cliente
          ? {
              ...venda.cliente,
              createdAt: venda.cliente.createdAt.toISOString(),
              updatedAt: venda.cliente.updatedAt.toISOString(),
            }
          : null,
      },
      { status: 201 }
    )
  } catch (e) {
    console.error('cliente/carrinho POST erro:', e)
    return NextResponse.json({ error: 'Erro ao finalizar compra' }, { status: 500 })
  }
}
