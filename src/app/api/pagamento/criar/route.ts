import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'
import { getOuCriarConfigPagamento } from '@/lib/mercado-pago'
import {
  criarOrderMercadoPago,
  mapearOrderParaVenda,
  type BoletoOrderData,
  type CardOrderData,
} from '@/lib/mercado-pago-orders'
import type { MetodoPagamento, PagamentoCriarResposta } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/pagamento/criar
 *
 * Checkout Transparente via Orders API.
 *
 * Body:
 *  - PIX:    { vendaId, metodo: 'pix' }
 *  - Cartão: { vendaId, metodo: 'cartao', card: {...tokenizado pelo Brick...} }
 *  - Boleto: { vendaId, metodo: 'boleto', boleto: {...dados do pagador...} }
 */
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
      vendaId,
      metodo,
      card,
      boleto,
    } = body as {
      vendaId?: string
      metodo?: MetodoPagamento
      card?: CardOrderData
      boleto?: BoletoOrderData
    }

    if (!vendaId) {
      return NextResponse.json(
        { error: 'vendaId é obrigatório' },
        { status: 400 }
      )
    }

    const metodosValidos: MetodoPagamento[] = ['pix', 'cartao', 'boleto']
    if (!metodo || !metodosValidos.includes(metodo)) {
      return NextResponse.json(
        { error: 'metodo inválido (use pix, cartao ou boleto)' },
        { status: 400 }
      )
    }

    const venda = await db.venda.findUnique({
      where: { id: vendaId },
      include: { itens: { include: { produto: true } } },
    })

    if (!venda) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
    }

    if (venda.clienteId && venda.clienteId !== cliente.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    if (venda.mercadoPagoStatus === 'approved' || venda.status === 'concluida') {
      return NextResponse.json(
        {
          error: 'Esta venda já foi paga',
          preferenceId: venda.mercadoPagoId || '',
          orderId: venda.mercadoPagoId || undefined,
          initPoint: venda.mercadoPagoPaymentUrl || '',
          simulado:
            !venda.mercadoPagoId || venda.mercadoPagoId.startsWith('SIM-'),
          mercadoPagoId: venda.mercadoPagoId || undefined,
        },
        { status: 409 }
      )
    }

    const config = await getOuCriarConfigPagamento()

    if (metodo === 'pix' && !config.pixAtivo) {
      return NextResponse.json({ error: 'PIX desativado' }, { status: 400 })
    }
    if (metodo === 'cartao' && !config.cartaoAtivo) {
      return NextResponse.json({ error: 'Cartão desativado' }, { status: 400 })
    }
    if (metodo === 'boleto' && !config.boletoAtivo) {
      return NextResponse.json({ error: 'Boleto desativado' }, { status: 400 })
    }

    const resultado = await criarOrderMercadoPago(
      {
        vendaId: venda.id,
        total: venda.total,
        metodo,
        payerEmail:
          card?.payer?.email ||
          boleto?.email ||
          cliente.email,
        card,
        boleto,
      },
      config
    )

    const statusMap = resultado.simulado
      ? {
          mercadoPagoStatus: 'pending',
          vendaStatus: 'pendente' as const,
          aprovado: false,
          rejeitado: false,
        }
      : mapearOrderParaVenda(resultado.status, resultado.statusDetail)

    const paymentUrl =
      resultado.ticketUrl ||
      resultado.challengeUrl ||
      null

    const qrPersistido =
      resultado.qrCodeBase64 ||
      resultado.qrCode ||
      null

    await db.venda.update({
      where: { id: venda.id },
      data: {
        mercadoPagoId: resultado.orderId,
        mercadoPagoStatus: statusMap.mercadoPagoStatus,
        mercadoPagoPaymentUrl: paymentUrl,
        mercadoPagoQrCode: qrPersistido,
        mercadoPagoPixExpiresAt: resultado.pixExpiresAt
          ? new Date(resultado.pixExpiresAt)
          : null,
        status: statusMap.vendaStatus,
        updatedAt: new Date(),
      },
    })

    // Mantém o modo simulado somente para desenvolvimento sem credenciais.
    if (resultado.simulado) {
      setTimeout(async () => {
        try {
          const v = await db.venda.findUnique({ where: { id: venda.id } })
          if (!v || v.mercadoPagoStatus === 'approved') return

          await db.venda.update({
            where: { id: venda.id },
            data: {
              mercadoPagoStatus: 'approved',
              status: 'concluida',
              updatedAt: new Date(),
            },
          })

          try {
            const { emitWebSocket } = await import('@/lib/realtime')
            await emitWebSocket('pagamento:aprovado', {
              vendaId: venda.id,
              simulado: true,
            })
          } catch {}
        } catch (e) {
          console.error('[pagamento/criar] simulado auto-approve erro:', e)
        }
      }, 10_000)
    } else if (statusMap.aprovado) {
      try {
        const { emitWebSocket } = await import('@/lib/realtime')
        await emitWebSocket('pagamento:aprovado', {
          vendaId: venda.id,
          mercadoPagoId: resultado.orderId,
          total: venda.total,
          simulado: false,
        })
      } catch {}
    }

    const resposta: PagamentoCriarResposta = {
      // Mantido por compatibilidade com a UI antiga.
      preferenceId: resultado.orderId,
      initPoint: resultado.ticketUrl || '',
      orderId: resultado.orderId,
      orderStatus: resultado.status,
      statusDetail: resultado.statusDetail,
      qrCode: resultado.qrCodeBase64,
      qrCodeBase64: resultado.qrCodeBase64,
      pixCopiaECola: resultado.qrCode,
      pixExpiresAt: resultado.pixExpiresAt,
      boletoUrl: metodo === 'boleto' ? resultado.ticketUrl : undefined,
      boletoLinhaDigitavel: resultado.boletoLinhaDigitavel,
      boletoCodigoBarras: resultado.boletoCodigoBarras,
      challengeUrl: resultado.challengeUrl,
      simulado: resultado.simulado,
      mercadoPagoId: resultado.orderId,
    }

    return NextResponse.json(resposta, { status: 200 })
  } catch (e: any) {
    console.error('[pagamento/criar] erro:', e)

    return NextResponse.json(
      { error: e?.message || 'Erro ao criar pagamento' },
      { status: 500 }
    )
  }
}
