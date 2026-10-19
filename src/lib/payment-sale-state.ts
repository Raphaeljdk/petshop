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
              produto: {
                select: {
                  id: true,
                  estoque: true,
                },
              },
            },
          },
        },
      })

      if (!current) return null

      const firstPendingCancellation =
        patch.status === 'cancelada' && current.status === 'pendente'

      if (firstPendingCancellation) {
        // Uma venda pendente já reservou o saldo no ERP local.
        // Restitua qualquer produto, independentemente do vínculo legado.
        for (const item of current.itens) {
          const produto = await tx.produto.update({
            where: { id: item.produtoId },
            data: { estoque: { increment: item.quantidade } },
            select: { estoque: true },
          })
          await tx.produto.update({
            where: { id: item.produtoId },
            data: { estoqueHub: produto.estoque },
          })
        }
        await tx.cupomUso.deleteMany({ where: { vendaId } })
      }

      // Estornos após conclusão devem ser conferidos antes de repor o estoque,
      // pois a mercadoria pode ter sido expedida.
      return tx.venda.update({
        where: { id: vendaId },
        data: {
          ...patch,
          updatedAt: new Date(),
        },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )
}
