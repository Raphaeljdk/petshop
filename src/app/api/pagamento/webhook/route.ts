import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOuCriarConfigPagamento } from '@/lib/mercado-pago'
import {
  consultarOrderMercadoPago,
  mapearOrderParaVenda,
  validarAssinaturaWebhook,
  webhookSecretConfigurado,
} from '@/lib/mercado-pago-orders'
import { emitWebSocket } from '@/lib/realtime'

export const dynamic = 'force-dynamic'

/**
 * POST /api/pagamento/webhook
 *
 * Webhook do Checkout Transparente (tópico Order).
 * A atualização local nunca confia somente no body recebido: sempre consulta
 * a order diretamente na API autenticada do Mercado Pago antes de alterar a venda.
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const orderId =
      url.searchParams.get('data.id') ||
      body?.data?.id ||
      null

    if (!orderId) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    if (webhookSecretConfigurado()) {
      const assinaturaValida = validarAssinaturaWebhook({
        xSignature: req.headers.get('x-signature'),
        xRequestId: req.headers.get('x-request-id'),
        dataId: orderId,
      })

      if (!assinaturaValida) {
        return NextResponse.json(
          { ok: false, error: 'Assinatura inválida' },
          { status: 401 }
        )
      }
    }

    const config = await getOuCriarConfigPagamento()

    // Busca os dados oficiais da order usando o Access Token do servidor.
    const order = await consultarOrderMercadoPago(orderId, config)
    const raw = order.raw || {}
    const externalReference = raw?.external_reference
      ? String(raw.external_reference)
      : null

    let venda = externalReference
      ? await db.venda.findUnique({ where: { id: externalReference } })
      : null

    if (!venda) {
      venda = await db.venda.findFirst({
        where: { mercadoPagoId: order.orderId },
      })
    }

    if (!venda) {
      return NextResponse.json({
        ok: true,
        vendaNotFound: true,
        orderId: order.orderId,
      })
    }

    const statusMap = mapearOrderParaVenda(order.status, order.statusDetail)

    const atualizado = await db.venda.update({
      where: { id: venda.id },
      data: {
        mercadoPagoId: order.orderId,
        mercadoPagoStatus: statusMap.mercadoPagoStatus,
        mercadoPagoPaymentUrl:
          order.ticketUrl ||
          order.challengeUrl ||
          venda.mercadoPagoPaymentUrl,
        mercadoPagoQrCode:
          order.qrCodeBase64 ||
          order.qrCode ||
          venda.mercadoPagoQrCode,
        status: statusMap.vendaStatus,
        updatedAt: new Date(),
      },
    })

    if (statusMap.aprovado) {
      await emitWebSocket('pagamento:aprovado', {
        vendaId: venda.id,
        mercadoPagoId: order.orderId,
        total: atualizado.total,
        simulado: false,
      })
    } else if (statusMap.rejeitado) {
      await emitWebSocket('pagamento:rejeitado', {
        vendaId: venda.id,
        status: order.status,
        statusDetail: order.statusDetail,
      })
    } else {
      await emitWebSocket('pagamento:atualizado', {
        vendaId: venda.id,
        status: order.status,
        statusDetail: order.statusDetail,
      })
    }

    return NextResponse.json({
      ok: true,
      vendaId: venda.id,
      orderId: order.orderId,
      status: order.status,
      statusDetail: order.statusDetail,
    })
  } catch (e: any) {
    console.error('[pagamento/webhook] erro:', e)

    // Retorna erro real para que o Mercado Pago possa tentar novamente.
    return NextResponse.json(
      { ok: false, error: e?.message || 'erro interno' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'matilha-prado-mercado-pago-orders-webhook',
  })
}
