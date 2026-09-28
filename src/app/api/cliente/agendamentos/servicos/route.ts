import { NextResponse } from 'next/server'
import { getSiggmaBookingConfig } from '@/lib/siggma/booking'

export async function GET() {
  const config = getSiggmaBookingConfig()

  return NextResponse.json(
    {
      configured: config.configured,
      writeConfigured: config.writeConfigured,
      services: config.services,
      missing: config.missing,
      fallback: config.configured ? null : 'solicitacao-equipe',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
