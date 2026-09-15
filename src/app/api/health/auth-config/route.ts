import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const missing: string[] = []
  const databaseUrl = process.env.DATABASE_URL || ''
  const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim() || ''
  const bootstrapCode = process.env.ADMIN_BOOTSTRAP_CODE?.trim() || ''
  const bootstrapValid = /^[a-f0-9]{64}$/i.test(bootstrapCode)
  const authSecretReady = nextAuthSecret.length >= 32 || bootstrapValid

  if (!databaseUrl) missing.push('DATABASE_URL')
  if (!authSecretReady) missing.push('AUTH_SECRET')
  if (!bootstrapValid) missing.push('ADMIN_BOOTSTRAP_CODE')

  const envNames = Object.keys(process.env)
  const databaseCandidates = envNames.filter(name => /DATABASE|POSTGRES|NEON|PGHOST|PGUSER|PGPORT|PGDATABASE/i.test(name)).sort()
  const authCandidates = envNames.filter(name => /NEXTAUTH|AUTH_SECRET|JWT_SECRET|ADMIN_BOOTSTRAP_CODE/i.test(name)).sort()

  let database = 'not-configured'
  let schema = 'not-checked'

  if (databaseUrl) {
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
      schema = 'not-checked'
    }
  }

  return NextResponse.json({
    ok: missing.length === 0 && database === 'reachable' && schema === 'ready',
    vercelEnv: process.env.VERCEL_ENV || null,
    missing,
    database,
    schema,
    authSecretReady,
    bootstrapReady: bootstrapValid,
    databaseCandidates,
    authCandidates,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
