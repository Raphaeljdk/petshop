import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { mercadoLivreClientId } from '@/lib/mercado-livre'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const configured = Boolean(mercadoLivreClientId() && process.env.MERCADO_LIVRE_CLIENT_SECRET && /^[a-f\d]{64}$/i.test(process.env.MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY || ''))
  try {
    const connection = await db.mercadoLivreConnection.findUnique({ where: { id: 'matilha-prado' }, select: { sellerId: true, connectedAt: true, accessTokenExpiresAt: true } })
    return NextResponse.json({ configured, databaseReady: true,
      connected: Boolean(connection), sellerId: connection?.sellerId || null, connectedAt: connection?.connectedAt || null,
      tokenExpired: connection ? connection.accessTokenExpiresAt <= new Date() : false }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ configured, connected: false, databaseReady: false,
      error: 'Não foi possível consultar a conexão. Verifique a migração MercadoLivreConnection e a conexão com o banco.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
