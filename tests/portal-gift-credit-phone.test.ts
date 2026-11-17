import { describe, expect, test } from 'bun:test'
import { quoteGiftCredit, GiftCreditError } from '../src/lib/portal-gift-credit'

type GiftDb = Parameters<typeof quoteGiftCredit>[0]

function fakeDb(recipientPhone: string | null, recipientEmail: string | null, clientPhone: string) {
  return {
    portalGiftRequest: {
      findUnique: async () => ({
        id: 'gift-1', status: 'pago', paidAt: new Date(),
        balanceCents: 5000, recipientPhone, recipientEmail,
      }),
    },
    cliente: { findUnique: async () => ({ telefone: clientPhone }) },
  } as unknown as GiftDb
}

describe('Vínculo de vale-presente ao destinatário', () => {
  test('novos vales aceitam telefone da mesma conta em formatos equivalentes', async () => {
    const old = process.env.PORTAL_GIFT_REDEMPTION_ENABLED
    process.env.PORTAL_GIFT_REDEMPTION_ENABLED = 'true'
    try {
      const value = await quoteGiftCredit(
        fakeDb('5511915942356', null, '(11) 91594-2356'),
        'MP-PRES-123456', 'client-1', 'outro@example.com', 2000,
      )
      expect(value.appliedCents).toBe(2000)
    } finally {
      if (old === undefined) delete process.env.PORTAL_GIFT_REDEMPTION_ENABLED
      else process.env.PORTAL_GIFT_REDEMPTION_ENABLED = old
    }
  })

  test('bloqueia resgate quando o telefone não pertence à conta', async () => {
    const old = process.env.PORTAL_GIFT_REDEMPTION_ENABLED
    process.env.PORTAL_GIFT_REDEMPTION_ENABLED = 'true'
    try {
      await expect(quoteGiftCredit(
        fakeDb('5511915942356', null, '11999998888'),
        'MP-PRES-123456', 'client-2', 'outro@example.com', 2000,
      )).rejects.toBeInstanceOf(GiftCreditError)
    } finally {
      if (old === undefined) delete process.env.PORTAL_GIFT_REDEMPTION_ENABLED
      else process.env.PORTAL_GIFT_REDEMPTION_ENABLED = old
    }
  })

  test('preserva o vínculo por e-mail dos vales antigos', async () => {
    const old = process.env.PORTAL_GIFT_REDEMPTION_ENABLED
    process.env.PORTAL_GIFT_REDEMPTION_ENABLED = 'true'
    try {
      const value = await quoteGiftCredit(
        fakeDb(null, 'presenteada@example.com', ''),
        'MP-PRES-123456', 'client-3', 'Presenteada@example.com', 2000,
      )
      expect(value.appliedCents).toBe(2000)
      await expect(quoteGiftCredit(
        fakeDb(null, 'presenteada@example.com', ''),
        'MP-PRES-123456', 'client-4', 'outro@example.com', 2000,
      )).rejects.toBeInstanceOf(GiftCreditError)
    } finally {
      if (old === undefined) delete process.env.PORTAL_GIFT_REDEMPTION_ENABLED
      else process.env.PORTAL_GIFT_REDEMPTION_ENABLED = old
    }
  })
})
