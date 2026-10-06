import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import {
  mercadoLivreAccessToken,
  mercadoLivreClientId,
} from '@/lib/mercado-livre'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getUsuarioLogado()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const configured = Boolean(
    mercadoLivreClientId() &&
      process.env.MERCADO_LIVRE_CLIENT_SECRET &&
      /^[a-f\d]{64}$/i.test(
        process.env.MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY || ''
      )
  )

  try {
    const [connection, integration] = await Promise.all([
      db.mercadoLivreConnection.findUnique({
        where: { id: 'matilha-prado' },
        select: {
          sellerId: true,
          connectedAt: true,
          accessTokenExpiresAt: true,
        },
      }),
      db.integracao
        .findUnique({
          where: { id: 'mercado-livre-oauth' },
          select: { ultimaSync: true },
        })
        .catch(() => null),
    ])

    const lastSync = integration?.ultimaSync?.toISOString() || null
    const tokenExpired = connection
      ? connection.accessTokenExpiresAt <= new Date()
      : false

    if (!connection) {
      return NextResponse.json(
        {
          configured,
          databaseReady: true,
          connected: false,
          catalogAccess: false,
          sellerId: null,
          connectedAt: null,
          tokenExpired: false,
          lastSync,
          error: null,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    if (!configured) {
      return NextResponse.json(
        {
          configured,
          databaseReady: true,
          connected: false,
          catalogAccess: false,
          sellerId: connection.sellerId,
          connectedAt: connection.connectedAt,
          tokenExpired,
          lastSync,
          error:
            'A conexão existe, mas faltam variáveis do Mercado Livre na Vercel.',
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    try {
      const { token, sellerId } = await mercadoLivreAccessToken()
      const response = await fetch(
        `https://api.mercadolibre.com/users/${encodeURIComponent(
          sellerId
        )}/items/search?limit=1&offset=0`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        throw new Error(
          `O Mercado Livre recusou a consulta do catálogo (HTTP ${response.status}).`
        )
      }

      return NextResponse.json(
        {
          configured,
          databaseReady: true,
          connected: true,
          catalogAccess: true,
          sellerId,
          connectedAt: connection.connectedAt,
          tokenExpired: false,
          lastSync,
          error: null,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    } catch (error) {
      return NextResponse.json(
        {
          configured,
          databaseReady: true,
          connected: false,
          catalogAccess: false,
          sellerId: connection.sellerId,
          connectedAt: connection.connectedAt,
          tokenExpired,
          lastSync,
          error:
            error instanceof Error
              ? error.message
              : 'Não foi possível validar a integração Mercado Livre.',
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }
  } catch {
    return NextResponse.json(
      {
        configured,
        connected: false,
        catalogAccess: false,
        databaseReady: false,
        sellerId: null,
        connectedAt: null,
        tokenExpired: false,
        lastSync: null,
        error:
          'Não foi possível consultar a conexão. Verifique a migração MercadoLivreConnection e a conexão com o banco.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
