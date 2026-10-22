import type { Prisma } from '@prisma/client'

// Paid online sales or completed counter sales; pending/refunded orders never qualify.
export const paidSaleWhere = {
  status: 'concluida',
  OR: [
    { mercadoPagoStatus: 'approved' },
    { mercadoPagoId: null, mercadoPagoStatus: null },
  ],
} satisfies Prisma.VendaWhereInput
