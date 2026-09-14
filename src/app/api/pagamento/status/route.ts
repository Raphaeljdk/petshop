import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/pagamento/status?vendaId=xxx
 *
 * Retorna o status atual do pagamento de uma venda.
 * O cliente usa para polling (verificar se foi aprovado).
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

    const venda = await db.venda.findUnique({
      where: { id: vendaId },
      select: {
        id: true,
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

    // Em modo simulado, se a venda foi criada há mais de 10s e ainda está
    // pending, o setTimeout do endpoint /criar já deve ter aprovado ela.
    // Aqui só retornamos o estado atual.

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
      // Flag de conveniência para o client
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
