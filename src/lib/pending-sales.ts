import { db } from '@/lib/db'
import { applyPaymentSaleState } from '@/lib/payment-sale-state'

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
    select: { id: true, status: true, createdAt: true },
  })

  if (!sale || !isPendingSaleExpired(sale, now)) return false

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
