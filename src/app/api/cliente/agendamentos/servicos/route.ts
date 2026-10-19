import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    configured: false,
    writeConfigured: false,
    services: [],
    missing: [],
    fallback: 'solicitacao-equipe',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
