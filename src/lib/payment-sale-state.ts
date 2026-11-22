import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { updateGiftRedemption } from '@/lib/portal-gift-credit'
import { awardReferralForPaidSale } from '@/lib/portal-referral-awards'
import { syncStockAfterHubWrite } from '@/lib/stock-sync-after-write'
import { creditReleasedReservation } from '@/lib/sale-stock-policy'

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
  const update=await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sale:${vendaId}`}))`

      const current = await tx.venda.findUnique({
        where: { id: vendaId },
        include: {
          itens: {
            include: {
              produto: {
                select: {
                  id: true,
                  estoque: true,
                  estoqueIlimitado: true,
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
          if(item.produto?.estoqueIlimitado)continue
          const produto = await tx.produto.update({
            where: { id: item.produtoId },
            data: { estoque: creditReleasedReservation(item.quantidade) },
            select: { estoque: true },
          })
          await tx.produto.update({
            where: { id: item.produtoId },
            data: { estoqueHub: produto.estoque },
          })
        }
        await tx.cupomUso.deleteMany({ where: { vendaId } })
      }

      if (patch.status==='concluida' && current.status==='pendente')
        await updateGiftRedemption(tx,vendaId,'concluida')
      if (firstPendingCancellation)
        await updateGiftRedemption(tx,vendaId,'cancelada')

      // Estornos após conclusão devem ser conferidos antes de repor o estoque,
      // pois a mercadoria pode ter sido expedida.
      const result=await tx.venda.update({
        where: { id: vendaId },
        data: {
          ...patch,
          updatedAt: new Date(),
        },
      })
      if(patch.status==='concluida'&&current.status==='pendente')
        await awardReferralForPaidSale(tx,vendaId)
      return {result,productIds:firstPendingCancellation
        ?current.itens.filter(item=>!item.produto?.estoqueIlimitado).map(item=>item.produtoId):[]}
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )
  if(update?.productIds.length)await syncStockAfterHubWrite(update.productIds)
  return update?.result??null
}
