import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado,getUsuarioLogado } from '@/lib/auth-helpers'
import { AuthError, readAuthBody } from '@/lib/auth-http'
import { getOuCriarConfigPagamento } from '@/lib/mercado-pago'
import {
  criarOrderMercadoPago,
  mapearOrderParaVenda,
  MercadoPagoGatewayError,
  type BoletoOrderData,
  type CardOrderData,
} from '@/lib/mercado-pago-orders'
import type { MetodoPagamento, PagamentoCriarResposta } from '@/lib/types'
import { applyPaymentSaleState } from '@/lib/payment-sale-state'
import { cancelExpiredPendingSale } from '@/lib/pending-sales'

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
    const usuario=await getUsuarioLogado()
    const equipe=usuario?.role==='ADMIN'||usuario?.role==='KANBAN'
    const cliente=equipe?null:await getClienteLogado()
    if(!equipe&&!cliente)return NextResponse.json({error:'Cliente não autenticado'},{status:401})
    const body = await readAuthBody(req)
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
      include: { itens: { include: { produto: true } }, bookingPagamento:{select:{id:true,status:true}},cliente:{select:{email:true}},comandaProcesso:{select:{comandaFechadaEm:true,status:true}} },
    })

    if (!venda) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
    }

    if(equipe&&(!venda.comandaProcessoId||!venda.comandaProcesso||venda.comandaProcesso.comandaFechadaEm||venda.comandaProcesso.status==='cancelado'||metodo!=='pix'||card||boleto||!venda.clienteId))return NextResponse.json({error:'A equipe só pode gerar PIX de uma comanda válida.'},{status:403})
    if (!equipe && venda.clienteId !== cliente?.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    if (await cancelExpiredPendingSale(venda.id)) {
      return NextResponse.json(
        {
          error:
            'Esta compra ficou pendente por mais de 4 horas e foi cancelada. Volte ao carrinho para gerar um novo pedido.',
        },
        { status: 409 }
      )
    }

    if (venda.status === 'cancelada') {
      return NextResponse.json(
        {
          error:
            'Esta compra foi cancelada. Volte ao carrinho e gere um novo pedido para reservar preço e estoque novamente.',
        },
        { status: 409 }
      )
    }

    const cobrancaPendente =
      venda.mercadoPagoId &&
      !venda.mercadoPagoId.startsWith('SIM-') &&
      ['pending', 'in_process', 'authorized'].includes(
        String(venda.mercadoPagoStatus || '').toLowerCase()
      )

    if (cobrancaPendente) {
      return NextResponse.json(
        {
          error:
            'Já existe uma cobrança pendente para esta compra. Aguarde a confirmação antes de gerar outra.',
        },
        { status: 409 }
      )
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

    if((venda.comandaProcessoId||venda.bookingPagamento)&&((venda.bookingPagamento&&venda.bookingPagamento.status!=='confirmado')||config.mercadoPagoSandbox||!(process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim()||config.mercadoPagoAccessToken?.trim())||(process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim()||config.mercadoPagoAccessToken?.trim())?.startsWith('TEST-')))return NextResponse.json({error:'Pagamento real da comanda ou agendamento indisponível.'},{status:409})
    if (metodo === 'pix' && !config.pixAtivo) {
      return NextResponse.json({ error: 'PIX desativado' }, { status: 400 })
    }
    if (metodo === 'cartao' && !config.cartaoAtivo) {
      return NextResponse.json({ error: 'Cartão desativado' }, { status: 400 })
    }
    if (metodo === 'boleto' && !config.boletoAtivo) {
      return NextResponse.json({ error: 'Boleto desativado' }, { status: 400 })
    }

    const valorRestante = Math.round((venda.total - venda.creditoPresenteCentavos / 100) * 100) / 100
    if (valorRestante <= 0) return NextResponse.json({ error:'Venda já coberta por vale-presente; não gere outra cobrança.' },{status:409})
    const resultado = await criarOrderMercadoPago(
      {
        vendaId: venda.id,
        total: valorRestante,
        metodo,
        payerEmail:
          card?.payer?.email ||
          boleto?.email ||
          (equipe?venda.cliente?.email:cliente?.email),
        card,
        boleto,
        attemptKey: venda.mercadoPagoId || 'initial',
        singleInvoice: Boolean(venda.bookingPagamento||venda.comandaProcessoId),
      },
      config
    )

    if((venda.comandaProcessoId||venda.bookingPagamento)&&resultado.simulado)return NextResponse.json({error:'Pagamento simulado não é aceito para comandas ou agendamentos.'},{status:409})
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

    await applyPaymentSaleState(venda.id, {
      mercadoPagoId: resultado.orderId,
      mercadoPagoStatus: statusMap.mercadoPagoStatus,
      mercadoPagoPaymentUrl: paymentUrl,
      mercadoPagoQrCode: qrPersistido,
      mercadoPagoPixExpiresAt: resultado.pixExpiresAt
        ? new Date(resultado.pixExpiresAt)
        : null,
      status: statusMap.vendaStatus,
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

    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }

    if (e instanceof MercadoPagoGatewayError) {
      return NextResponse.json(
        {
          error:
            'O pagamento online está temporariamente indisponível. Nenhuma cobrança foi realizada. Tente novamente mais tarde.',
          code: e.code,
        },
        { status: e.blocked ? 503 : 502 }
      )
    }

    return NextResponse.json(
      {
        error:
          'Não foi possível iniciar o pagamento agora. Nenhuma cobrança foi realizada. Tente novamente.',
      },
      { status: 500 }
    )
  }
}
