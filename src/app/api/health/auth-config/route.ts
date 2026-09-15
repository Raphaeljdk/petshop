import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const databaseConfigured = Boolean(process.env.DATABASE_URL)
  const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim() || ''
  const bootstrapCode = process.env.ADMIN_BOOTSTRAP_CODE?.trim() || ''
  const authConfigured = nextAuthSecret.length >= 32 || /^[a-f0-9]{64}$/i.test(bootstrapCode)

  let database = databaseConfigured ? 'unreachable' : 'not-configured'
  let schema = 'not-checked'

  if (databaseConfigured) {
    try {
      await db.$queryRaw`SELECT 1`
      database = 'reachable'
      try {
        await Promise.all([
          db.user.count(),
          db.cliente.count(),
          db.authAttempt.count(),
          db.adminInvitation.count(),
        ])
        schema = 'ready'
      } catch {
        schema = 'missing-or-outdated'
      }
    } catch {
      database = 'unreachable'
    }
  }

  const ok = authConfigured && database === 'reachable' && schema === 'ready'
  return NextResponse.json({
    ok,
    auth: authConfigured ? 'ready' : 'not-configured',
    database,
    schema,
  }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
