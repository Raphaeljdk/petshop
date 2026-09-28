import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export type PaymentSalePatch = {
  mercadoPagoId?: string | null
  mercadoPagoStatus?: string | null
  mercadoPagoPaymentUrl?: string | null
  mercadoPagoQrCode?: string | null
  mercadoPagoPixExpiresAt?: Date | null
  status: 'concluida' | 'pendente' | 'cancelada'
}

export async function applyPaymentSaleState(
  vendaId: string,
  patch: PaymentSalePatch
) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment:${vendaId}`}))`

      const current = await tx.venda.findUnique({
        where: { id: vendaId },
        include: {
          itens: {
            include: {
              produto: { select: { id: true, zettaProCod: true } },
            },
          },
        },
      })

      if (!current) return null

      const firstPendingCancellation =
        patch.status === 'cancelada' && current.status === 'pendente'
      const cancellationAfterApproval =
        patch.status === 'cancelada' && current.status === 'concluida'

      if (firstPendingCancellation) {
        for (const item of current.itens) {
          if (!item.produto.zettaProCod) {
            await tx.produto.update({
              where: { id: item.produtoId },
              data: { estoque: { increment: item.quantidade } },
            })
          }
        }
        await tx.cupomUso.deleteMany({ where: { vendaId } })
      }

      const requiresErpReview =
        cancellationAfterApproval && Boolean(current.siggmaImportedAt)

      return tx.venda.update({
        where: { id: vendaId },
        data: {
          ...patch,
          ...(requiresErpReview
            ? {
                siggmaImportStatus: 'cancelamento-revisao',
                siggmaImportError:
                  'Pagamento cancelado/estornado após importação no Siggma. Revisar cancelamento no ERP antes de ajustar estoque.',
              }
            : {}),
          updatedAt: new Date(),
        },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )
}
