import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'
import { getOpcaoFrete, normalizarCep, validarCep } from '@/lib/frete'
import { emitWebSocket } from '@/lib/realtime'
import { getZettaProduct, zettaProductPrice, zettaProductStock } from '@/lib/zetta-products'
import { integrationBridgeRequest } from '@/lib/integration-bridge'
import {
  calcularComissaoCupom,
  CupomValidationError,
  validarCupom,
} from '@/lib/cupons'

class CheckoutError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

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
      return NextResponse.json({ error: 'Carrinho vazio' }, { status: 400 })
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
        { error: 'Há itens inválidos no carrinho.' },
        { status: 400 }
      )
    }

    if (!tipoEntrega) {
      return NextResponse.json(
        { error: 'Selecione uma opção de entrega' },
        { status: 400 }
      )
    }

    const ids = [...new Set(itens.map((item) => item.produtoId))]
    const produtosLocais = await db.produto.findMany({
      where: { id: { in: ids } },
    })

    const byId = new Map(produtosLocais.map((produto) => [produto.id, produto]))
    if (byId.size !== ids.length) {
      throw new CheckoutError('Um ou mais produtos não foram encontrados.', 404)
    }

    // ---------- Frete ----------
    // Tipos aceitos e valor correspondente confirmado no backend.
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
        throw new CheckoutError('CEP de entrega inválido')
      }

      const cepNormalizado = normalizarCep(cepEntrega)
      const opcao = await getOpcaoFrete(cepNormalizado, tipo)

      if (!opcao || !opcao.disponivel) {
        throw new CheckoutError(
          tipo === 'entrega_propria'
            ? 'Entrega própria não disponível para este CEP (fora da área de cobertura)'
            : 'Sedex indisponível no momento'
        )
      }

      valorFrete = opcao.valor
      prazoEntrega = opcao.prazo
      cepFinal = cepNormalizado
      enderecoFinal = enderecoEntrega?.trim() || cliente.endereco || null
    } else {
      throw new CheckoutError('Tipo de entrega inválido')
    }

    // ---------- Validação final de preço e estoque ----------
    // Produtos vinculados ao ERP nunca confiam no cache local antes da cobrança.
    const itensValidados = await Promise.all(
      itens.map(async (item) => {
        const produto = byId.get(item.produtoId)
        if (!produto || !produto.ativo) {
          throw new CheckoutError('Produto não encontrado ou indisponível.', 404)
        }

        if (produto.zettaProCod) {
          let official
          try {
            official = await getZettaProduct(produto.zettaProCod)
          } catch (error) {
            console.error('[checkout] falha ao validar produto no Zetta:', error)
            throw new CheckoutError(
              `Não foi possível validar o estoque de ${produto.nome} no ERP. Tente novamente em instantes.`,
              503
            )
          }

          if (official.excluido) {
            throw new CheckoutError(`${produto.nome} não está mais disponível.`)
          }

          const estoque = zettaProductStock(official)
          const precoUnit = zettaProductPrice(official)

          if (precoUnit <= 0) {
            throw new CheckoutError(
              `${produto.nome} está sem preço válido no ERP. A compra foi bloqueada.`
            )
          }

          if (estoque < item.quantidade) {
            throw new CheckoutError(
              `Estoque insuficiente para ${official.nome || produto.nome}. Disponível: ${estoque}.`
            )
          }

          return {
            produtoId: produto.id,
            quantidade: item.quantidade,
            precoUnit,
            estoqueConfirmado: estoque,
            zettaProCod: produto.zettaProCod,
          }
        }

        if (produto.estoque < item.quantidade) {
          throw new CheckoutError(`Estoque insuficiente para ${produto.nome}`)
        }

        return {
          produtoId: produto.id,
          quantidade: item.quantidade,
          precoUnit: produto.precoPromo ?? produto.preco,
          estoqueConfirmado: produto.estoque,
          zettaProCod: null,
        }
      })
    )

    const temProdutoZetta = itensValidados.some((item) => item.zettaProCod)

    // O banco Zetta liberado para o Hub é somente leitura. Não cobramos itens do
    // ERP até a Zetta fornecer o endpoint oficial de criação do pedido/movimentação.
    if (temProdutoZetta) {
      let orderWriteConfigured = false
      try {
        const bridgeStatus = await integrationBridgeRequest<{
          siggmaOrderWriteConfigured?: boolean
        }>('/api/status')
        orderWriteConfigured = Boolean(bridgeStatus.siggmaOrderWriteConfigured)
      } catch (error) {
        console.error('[checkout] falha ao consultar prontidão de pedidos no bridge:', error)
      }

      if (!orderWriteConfigured) {
        throw new CheckoutError(
          'O catálogo do ERP já está sincronizado, mas a venda online destes produtos aguarda a liberação do endpoint oficial de pedidos da Zetta. Nenhuma cobrança foi realizada.',
          503
        )
      }
    }

    // ---------- Venda ----------
    const venda = await db.$transaction(async (tx) => {
      let subtotal = 0
      const itensData: Array<{
        produtoId: string
        quantidade: number
        precoUnit: number
      }> = []

      for (const item of itensValidados) {
        const produto = await tx.produto.findUnique({
          where: { id: item.produtoId },
        })

        if (!produto || !produto.ativo) {
          throw new CheckoutError('Produto não encontrado ou inativo.')
        }

        // Produto local continua usando controle transacional no Neon.
        if (!item.zettaProCod) {
          if (produto.estoque < item.quantidade) {
            throw new CheckoutError(`Estoque insuficiente para ${produto.nome}`)
          }

          await tx.produto.update({
            where: { id: item.produtoId },
            data: { estoque: { decrement: item.quantidade } },
          })
        } else {
          // Mantém o cache local alinhado ao que acabou de ser lido do ERP.
          await tx.produto.update({
            where: { id: item.produtoId },
            data: {
              preco: item.precoUnit,
              estoque: item.estoqueConfirmado,
              precoPromo: null,
            },
          })
        }

        subtotal += item.precoUnit * item.quantidade
        itensData.push({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnit: item.precoUnit,
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
          status: 'pendente',
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
    if (e instanceof CheckoutError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }

    console.error('cliente/carrinho POST erro:', e)
    return NextResponse.json(
      { error: 'Erro ao finalizar compra' },
      { status: 500 }
    )
  }
}
