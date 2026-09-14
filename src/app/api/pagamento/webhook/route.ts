import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getOuCriarConfigPagamento,
  consultarStatusMP,
  statusMPToVenda,
} from '@/lib/mercado-pago'
import { emitWebSocket } from '@/lib/realtime'

export const dynamic = 'force-dynamic'

/**
 * POST /api/pagamento/webhook
 *
 * Recebe notificações do Mercado Pago (IPN / Webhook).
 *
 * Tipos de notificação:
 *  - payment: { id } → consultar status do pagamento via API
 *  - merchant_order: { id } → lista de pagamentos relacionados
 *
 * Quando status = approved, marca a venda como "concluida" e emite WS.
 *
 * Importante: o MP pode chamar este endpoint sem autenticação (o token vem
 * na querystring ?data.id=...&type=payment). Por isso, validamos vendendo
 * pela external_reference = vendaId e pelo payment_id.
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const tipo = url.searchParams.get('type') || url.searchParams.get('topic')
    const dataId = url.searchParams.get('data.id') || url.searchParams.get('id')

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    // Identifica o payment_id de várias fontes possíveis
    const paymentId =
      body?.data?.id ||
      body?.id ||
      body?.resource?.split('/').pop() ||
      (dataId && tipo === 'payment' ? dataId : null) ||
      null

    const externalReference =
      body?.external_reference ||
      body?.data?.external_reference ||
      null

    if (!paymentId && !externalReference) {
      // Pode ser um handshake do MP sem dados — responde 200 para não reterir
      return NextResponse.json({ ok: true, ignored: true })
    }

    // Tenta localizar a venda pela external_reference primeiro
    let venda = externalReference
      ? await db.venda.findUnique({ where: { id: externalReference } })
      : null

    // Senão, busca pelo mercadoPagoId
    if (!venda && paymentId) {
      venda = await db.venda.findFirst({
        where: { mercadoPagoId: String(paymentId) },
      })
    }

    if (!venda) {
      // Não achamos a venda — mesmo assim respondemos 200 para o MP não reterir
      return NextResponse.json({ ok: true, vendaNotFound: true })
    }

    // Se já está aprovada, não processa de novo
    if (venda.mercadoPagoStatus === 'approved') {
      return NextResponse.json({ ok: true, alreadyApproved: true })
    }

    const config = await getOuCriarConfigPagamento()

    // Se temos o paymentId real (não SIM-), consulta o status real
    let statusMP: string | null = null
    if (paymentId && !String(paymentId).startsWith('SIM-')) {
      statusMP = body?.action === 'payment.updated'
        ? body?.data?.status ||
          body?.status ||
          null
        : await consultarStatusMP(String(paymentId), config)
      // Fallback: alguns webhooks trazem o status no body
      if (!statusMP) {
        statusMP = body?.status || body?.data?.status || null
      }
    }

    if (!statusMP) {
      // Sem status — assume pending
      statusMP = 'pending'
    }

    const statusVenda = statusMPToVenda(statusMP)

    const atualizado = await db.venda.update({
      where: { id: venda.id },
      data: {
        mercadoPagoId: paymentId ? String(paymentId) : venda.mercadoPagoId,
        mercadoPagoStatus: statusMP.toLowerCase(),
        status: statusVenda || venda.status,
        updatedAt: new Date(),
      },
    })

    // Emite WebSocket de acordo com o status
    if (statusMP === 'approved' || statusMP === 'authorized') {
      await emitWebSocket('pagamento:aprovado', {
        vendaId: venda.id,
        mercadoPagoId: paymentId ? String(paymentId) : venda.mercadoPagoId,
        total: atualizado.total,
        simulado: false,
      })
    } else if (statusMP === 'rejected' || statusMP === 'cancelled') {
      await emitWebSocket('pagamento:rejeitado', { vendaId: venda.id, status: statusMP })
    } else {
      await emitWebSocket('pagamento:atualizado', {
        vendaId: venda.id,
        status: statusMP,
      })
    }

    return NextResponse.json({ ok: true, vendaId: venda.id, status: statusMP })
  } catch (e: any) {
    console.error('[pagamento/webhook] erro:', e)
    // Mesmo em erro, responde 200 para o MP não ficar retentando
    return NextResponse.json(
      { ok: false, error: e?.message || 'erro interno' },
      { status: 200 }
    )
  }
}

/**
 * GET /api/pagamento/webhook
 *
 * Algumas integrações MP fazem um GET de verificação inicial.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const challenge = url.searchParams.get('hub.challenge')
  if (challenge) {
    return NextResponse.json({ hubChallenge: challenge })
  }
  return NextResponse.json({ ok: true, service: 'matilha-prado-webhook' })
}
