import { NextResponse } from 'next/server'
import { portalCliente } from '@/lib/portal-care'
import { experienceError } from '@/lib/customer-experience'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    await portalCliente()
    return NextResponse.json({
      subscriptionsEnabled: process.env.PORTAL_SUBSCRIPTIONS_ENABLED === 'true',
      giftRedemptionEnabled: process.env.PORTAL_GIFT_REDEMPTION_ENABLED === 'true',
      notificationsEnabled: process.env.PORTAL_NOTIFICATIONS_ENABLED === 'true',
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return experienceError(error) }
}
