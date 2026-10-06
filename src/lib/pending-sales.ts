import { db } from '@/lib/db'
import { applyPaymentSaleState } from '@/lib/payment-sale-state'
import { getOuCriarConfigPagamento } from '@/lib/mercado-pago'
import {
  cancelarOrderMercadoPago,
  consultarOrderMercadoPago,
  mapearOrderParaVenda,
} from '@/lib/mercado-pago-orders'

export const PENDING_SALE_TTL_MS = 4 * 60 * 60 * 1000

export function pendingSaleExpiresAt(createdAt: Date) {
  return new Date(createdAt.getTime() + PENDING_SALE_TTL_MS)
}

export function isPendingSaleExpired(
  sale: { status: string; createdAt: Date },
  now = new Date()
) {
  return (
    sale.status === 'pendente' &&
    pendingSaleExpiresAt(sale.createdAt).getTime() <= now.getTime()
  )
}

export async function cancelExpiredPendingSale(vendaId: string, now = new Date()) {
  const sale = await db.venda.findUnique({
    where: { id: vendaId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      mercadoPagoId: true,
    },
  })

  if (!sale || !isPendingSaleExpired(sale, now)) return false

  if (
    sale.mercadoPagoId &&
    !sale.mercadoPagoId.startsWith('SIM-') &&
    !sale.mercadoPagoId.startsWith('SIM_')
  ) {
    const config = await getOuCriarConfigPagamento()

    try {
      const cancelled = await cancelarOrderMercadoPago(sale.mercadoPagoId, config)
      if (!cancelled.canceled) return false
    } catch (cancelError) {
      try {
        const order = await consultarOrderMercadoPago(sale.mercadoPagoId, config)
        const state = mapearOrderParaVenda(order.status, order.statusDetail)

        if (state.aprovado) {
          await applyPaymentSaleState(sale.id, {
            status: 'concluida',
            mercadoPagoStatus: state.mercadoPagoStatus,
          })
          return false
        }

        if (!state.rejeitado) {
          console.error(
            '[pending-sales] Mercado Pago não confirmou cancelamento:',
            sale.id,
            cancelError
          )
          return false
        }
      } catch (statusError) {
        console.error(
          '[pending-sales] não foi possível confirmar cancelamento no gateway:',
          sale.id,
          statusError
        )
        return false
      }
    }
  }

  await applyPaymentSaleState(sale.id, {
    status: 'cancelada',
    mercadoPagoStatus: 'expired_local',
  })

  return true
}

export async function cancelExpiredPendingSales(now = new Date()) {
  const cutoff = new Date(now.getTime() - PENDING_SALE_TTL_MS)
  const expired = await db.venda.findMany({
    where: {
      status: 'pendente',
      createdAt: { lte: cutoff },
    },
    select: { id: true },
    take: 500,
  })

  let cancelled = 0
  for (const sale of expired) {
    try {
      if (await cancelExpiredPendingSale(sale.id, now)) cancelled += 1
    } catch (error) {
      console.error('[pending-sales] falha ao cancelar venda:', sale.id, error)
    }
  }

  return { checked: expired.length, cancelled, cutoff }
}
