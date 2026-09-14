import { createHash, randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { emailSchema, fieldErrors } from '@/lib/auth-validation'
import { AuthError, assertSameOrigin, authFailure, authJson, authReady, limitAuthAttempts, readAuthBody } from '@/lib/auth-http'

const inviteSchema = z.object({ email: emailSchema }).strict()
const publicFields = { id: true, email: true, expiresAt: true, usedAt: true, revokedAt: true, createdAt: true } as const

async function requireAdmin() {
  authReady()
  const user = await getUsuarioLogado()
  if (!user) throw new AuthError('Entre na sua conta para continuar.', 401)
  if (user.role !== 'ADMIN') throw new AuthError('Acesso permitido apenas à administração.', 403)
  return user
}

export async function GET() {
  try {
    await requireAdmin()
    const invitations = await db.adminInvitation.findMany({ select: publicFields, orderBy: { createdAt: 'desc' }, take: 50 })
    return authJson({ success: true, invitations })
  } catch (error) { return authFailure(error) }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req)
    const admin = await requireAdmin()
    const parsed = inviteSchema.safeParse(await readAuthBody(req))
    if (!parsed.success) return authJson({ success: false, error: 'Informe um e-mail válido.', fields: fieldErrors(parsed.error) }, 400)
    const limited = await limitAuthAttempts('invite', admin.id, 20, 60)
    if (limited) return limited
    const { email } = parsed.data
    if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new AuthError('Este e-mail já possui uma conta. Use outro e-mail para o novo administrador.', 409)
    }
    const code = randomBytes(32).toString('hex')
    const invitation = await db.$transaction(async tx => {
      await tx.adminInvitation.updateMany({ where: { email, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } })
      return tx.adminInvitation.create({
        data: { email, tokenHash: createHash('sha256').update(code).digest('hex'), expiresAt: new Date(Date.now() + 48 * 60 * 60_000), createdById: admin.id },
        select: publicFields,
      })
    })
    // O código é exibido uma única vez. Não há envio automático de mensagens.
    return authJson({ success: true, invitation, code }, 201)
  } catch (error) { return authFailure(error) }
}

export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req)
    await requireAdmin()
    const id = req.nextUrl.searchParams.get('id')
    if (!id || id.length > 100) throw new AuthError('Convite inválido.')
    const result = await db.adminInvitation.updateMany({
      where: { id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    })
    if (!result.count) throw new AuthError('O convite não está mais ativo.', 409)
    return authJson({ success: true })
  } catch (error) { return authFailure(error) }
}
