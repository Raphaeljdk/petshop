import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'
import { getOuCriarConfigPagamento } from '@/lib/mercado-pago'
import {
  consultarOrderMercadoPago,
  mapearOrderParaVenda,
} from '@/lib/mercado-pago-orders'
import { importarVendaNoSiggma } from '@/lib/siggma/orders'

export const dynamic = 'force-dynamic'

/**
 * GET /api/pagamento/status?vendaId=xxx
 *
 * Retorna o estado local e, quando há uma order real do Mercado Pago ainda
 * pendente, consulta /v1/orders/{id} para reconciliar o status.
 */
export async function GET(req: NextRequest) {
  try {
    const cliente = await getClienteLogado()
    if (!cliente) {
      return NextResponse.json(
        { error: 'Cliente não autenticado' },
        { status: 401 }
      )
    }

    const url = new URL(req.url)
    const vendaId = url.searchParams.get('vendaId')

    if (!vendaId) {
      return NextResponse.json(
        { error: 'vendaId é obrigatório' },
        { status: 400 }
      )
    }

    let venda = await db.venda.findUnique({
      where: { id: vendaId },
      select: {
        id: true,
        clienteId: true,
        status: true,
        total: true,
        mercadoPagoId: true,
        mercadoPagoStatus: true,
        mercadoPagoPaymentUrl: true,
        mercadoPagoQrCode: true,
        mercadoPagoPixExpiresAt: true,
        updatedAt: true,
      },
    })

    if (!venda) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
    }

    if (venda.clienteId && venda.clienteId !== cliente.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const orderId = venda.mercadoPagoId
    const deveReconciliar =
      Boolean(
        orderId &&
          !orderId.startsWith('SIM-') &&
          !orderId.startsWith('SIM_')
      ) &&
      venda.status !== 'concluida' &&
      venda.status !== 'cancelada'

    if (deveReconciliar && orderId) {
      try {
        const config = await getOuCriarConfigPagamento()
        const order = await consultarOrderMercadoPago(orderId, config)
        const statusMap = mapearOrderParaVenda(order.status, order.statusDetail)

        venda = await db.venda.update({
          where: { id: venda.id },
          data: {
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
          select: {
            id: true,
            clienteId: true,
            status: true,
            total: true,
            mercadoPagoId: true,
            mercadoPagoStatus: true,
            mercadoPagoPaymentUrl: true,
            mercadoPagoQrCode: true,
            mercadoPagoPixExpiresAt: true,
            updatedAt: true,
          },
        })

        if (statusMap.aprovado) {
          try {
            await importarVendaNoSiggma(venda.id)
          } catch (siggmaError) {
            console.error('[pagamento/status] pagamento aprovado, pedido Siggma pendente:', siggmaError)
          }
        }
      } catch (e) {
        // O webhook continua sendo a fonte principal. Falha de polling não
        // deve derrubar a tela do cliente.
        console.error('[pagamento/status] reconciliação MP falhou:', e)
      }
    }

    return NextResponse.json({
      vendaId: venda.id,
      statusVenda: venda.status,
      mercadoPagoStatus: venda.mercadoPagoStatus,
      mercadoPagoId: venda.mercadoPagoId,
      total: venda.total,
      paymentUrl: venda.mercadoPagoPaymentUrl,
      qrCode: venda.mercadoPagoQrCode,
      pixExpiresAt: venda.mercadoPagoPixExpiresAt
        ? venda.mercadoPagoPixExpiresAt.toISOString()
        : null,
      aprovado:
        venda.mercadoPagoStatus === 'approved' ||
        venda.mercadoPagoStatus === 'authorized' ||
        venda.status === 'concluida',
      rejeitado:
        venda.mercadoPagoStatus === 'rejected' ||
        venda.mercadoPagoStatus === 'cancelled' ||
        venda.status === 'cancelada',
      simulado:
        !venda.mercadoPagoId ||
        venda.mercadoPagoId.startsWith('SIM_') ||
        venda.mercadoPagoId.startsWith('SIM-'),
      updatedAt: venda.updatedAt.toISOString(),
    })
  } catch (e: any) {
    console.error('[pagamento/status] erro:', e)

    return NextResponse.json(
      { error: e?.message || 'Erro ao consultar status' },
      { status: 500 }
    )
  }
}
