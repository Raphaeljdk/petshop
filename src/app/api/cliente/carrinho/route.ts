import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'
import { getOpcaoFrete, normalizarCep, validarCep } from '@/lib/frete'
import { emitWebSocket } from '@/lib/realtime'
import {
  calcularComissaoCupom,
  CupomValidationError,
  validarCupom,
} from '@/lib/cupons'

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
      cupomCodigo,
    } = body as {
      itens: Array<{ produtoId: string; quantidade: number }>
      observacoes?: string
      tipoEntrega?: 'retirada' | 'entrega_propria' | 'sedex' | null
      cepEntrega?: string
      enderecoEntrega?: string
      cupomCodigo?: string | null
    }

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json(
        { error: 'Carrinho vazio' },
        { status: 400 }
      )
    }

    if (itens.some((item) => !item.produtoId || !Number.isInteger(item.quantidade) || item.quantidade <= 0)) {
      return NextResponse.json({ error: 'Há itens inválidos no carrinho.' }, { status: 400 })
    }

    if (!tipoEntrega) {
      return NextResponse.json(
        { error: 'Selecione uma opção de entrega' },
        { status: 400 }
      )
    }

    // Validação preliminar de estoque. A conferência definitiva acontece novamente
    // dentro da transação para impedir divergências entre carrinho e pagamento.
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
      valorFrete = 0
      prazoEntrega = null
      cepFinal = null
      enderecoFinal = null
    } else if (tipo === 'entrega_propria' || tipo === 'sedex') {
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
        if (!produto || !produto.ativo) throw new Error('Produto não encontrado ou inativo')
        if (produto.estoque < item.quantidade) {
          throw new Error(`Estoque insuficiente para ${produto.nome}`)
        }

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

      const cupomAplicado = cupomCodigo?.trim()
        ? await validarCupom(tx, {
            codigo: cupomCodigo,
            subtotal,
            clienteId: cliente.id,
          })
        : null

      const descontoCupom = cupomAplicado?.desconto ?? 0
      const valorProdutosLiquido = Math.max(0, subtotal - descontoCupom)
      const total = valorProdutosLiquido + valorFrete

      const novaVenda = await tx.venda.create({
        data: {
          clienteId: cliente.id,
          total,
          subtotalProdutos: subtotal,
          cupomId: cupomAplicado?.cupom.id ?? null,
          cupomCodigo: cupomAplicado?.codigo ?? null,
          descontoCupom,
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
        include: {
          cliente: true,
          cupom: true,
          itens: { include: { produto: true } },
        },
      })

      if (cupomAplicado) {
        await tx.cupomUso.create({
          data: {
            cupomId: cupomAplicado.cupom.id,
            vendaId: novaVenda.id,
            clienteId: cliente.id,
            codigo: cupomAplicado.codigo,
            desconto: descontoCupom,
            comissao: calcularComissaoCupom(
              valorProdutosLiquido,
              cupomAplicado.cupom.comissaoPercentual
            ),
          },
        })
      }

      return novaVenda
    })

    await emitWebSocket('venda:nova', {
      id: venda.id,
      total: venda.total,
      canal: venda.canal,
      clienteId: cliente.id,
      cupomCodigo: venda.cupomCodigo,
      descontoCupom: venda.descontoCupom,
    })

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
        cupom: venda.cupom
          ? {
              ...venda.cupom,
              inicioEm: venda.cupom.inicioEm?.toISOString() ?? null,
              fimEm: venda.cupom.fimEm?.toISOString() ?? null,
              createdAt: venda.cupom.createdAt.toISOString(),
              updatedAt: venda.cupom.updatedAt.toISOString(),
            }
          : null,
      },
      { status: 201 }
    )
  } catch (e) {
    if (e instanceof CupomValidationError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('cliente/carrinho POST erro:', e)
    const mensagem = e instanceof Error && e.message.startsWith('Estoque insuficiente')
      ? e.message
      : 'Erro ao finalizar compra'
    return NextResponse.json({ error: mensagem }, { status: mensagem === 'Erro ao finalizar compra' ? 500 : 400 })
  }
}
