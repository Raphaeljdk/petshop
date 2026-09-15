import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { assertAuthConfigured } from '@/lib/auth-cookies'

export class AuthError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== req.nextUrl.origin)) {
    throw new AuthError('Solicitação não permitida.', 403)
  }
}

export async function readAuthBody(req: NextRequest): Promise<unknown> {
  assertSameOrigin(req)
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new AuthError('Envie os dados em formato JSON.', 415)
  }
  const raw = await req.text()
  if (new TextEncoder().encode(raw).length > 16_384) throw new AuthError('Formulário muito grande.', 413)
  try { return JSON.parse(raw) } catch { throw new AuthError('Formulário inválido.', 400) }
}

export function authReady() {
  const missing: string[] = []
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL')
  else if (process.env.VERCEL && process.env.DATABASE_URL.startsWith('file:')) missing.push('DATABASE_URL_POSTGRESQL')

  try { assertAuthConfigured() } catch { missing.push('AUTH_SECRET') }

  if (missing.length > 0) {
    console.error('Configuração de autenticação indisponível:', missing.join(', '))
    const isPreview = process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development'
    const message = isPreview
      ? `Configuração incompleta neste ambiente da Vercel: ${missing.join(', ')}. Salve a variável correta e faça um novo deploy.`
      : 'O acesso está temporariamente indisponível. A configuração do servidor ainda não foi concluída.'
    throw new AuthError(message, 503)
  }
}

export function authJson(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', ...extraHeaders } })
}

export function authFailure(error: unknown) {
  if (error instanceof AuthError) return authJson({ success: false, error: error.message }, error.status)
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return authJson({ success: false, error: 'Não foi possível cadastrar este e-mail. Se já tem uma conta, entre ou procure a equipe.' }, 409)
  }
  console.error('Falha na autenticação:', error instanceof Prisma.PrismaClientKnownRequestError ? error.code : 'indisponível')
  return authJson({ success: false, error: 'Não foi possível concluir agora. Tente novamente em alguns instantes.' }, 503)
}

export async function limitAuthAttempts(scope: string, email: string, limit = 10, minutes = 10) {
  const now = new Date()
  const key = createHash('sha256').update(scope + ':' + email).digest('hex')
  const record = await db.$transaction(async tx => {
    await tx.authAttempt.deleteMany({ where: { key, expiresAt: { lte: now } } })
    return tx.authAttempt.upsert({
      where: { key },
      create: { key, attempts: 1, expiresAt: new Date(now.getTime() + minutes * 60_000) },
      update: { attempts: { increment: 1 } },
    })
  })
  if (record.attempts > limit) {
    return authJson({ success: false, error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, 429, {
      'Retry-After': String(Math.max(1, Math.ceil((record.expiresAt.getTime() - now.getTime()) / 1000))),
    })
  }
  return null
}
