import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { bcrypt, criarToken, setCookieAuth } from '@/lib/auth-cookies'
import { adminRegistrationSchema, fieldErrors } from '@/lib/auth-validation'
import { AuthError, authFailure, authJson, authReady, limitAuthAttempts, readAuthBody } from '@/lib/auth-http'

export async function POST(req: NextRequest) {
  try {
    const parsed = adminRegistrationSchema.safeParse(await readAuthBody(req))
    if (!parsed.success) return authJson({ success: false, error: 'Revise os campos indicados.', fields: fieldErrors(parsed.error) }, 400)
    authReady()
    const { nome, email, senha, convite } = parsed.data
    const limited = await limitAuthAttempts('register-admin', email, 5, 15)
    if (limited) return limited
    const tokenHash = createHash('sha256').update(convite).digest('hex')
    const senhaHash = await bcrypt.hash(senha, 12)
    const user = await db.$transaction(async tx => {
      const now = new Date()
      const invitation = await tx.adminInvitation.findUnique({
        where: { tokenHash }, include: { createdBy: { select: { ativo: true, role: true } } },
      })
      if (!invitation || invitation.email !== email || invitation.usedAt || invitation.revokedAt
        || invitation.expiresAt <= now
        || (invitation.createdById && (!invitation.createdBy?.ativo || invitation.createdBy.role !== 'ADMIN'))) {
        throw new AuthError('Convite inválido, expirado ou destinado a outro e-mail. Solicite um novo à administração.', 403)
      }
      const consumed = await tx.adminInvitation.updateMany({
        where: { id: invitation.id, email, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      })
      if (consumed.count !== 1) throw new AuthError('Este convite não está mais disponível.', 403)
      // Consumo e criação pertencem à mesma transação: falhas não gastam o convite.
      return tx.user.create({
        data: { nome, email, senha: senhaHash, role: 'ADMIN' },
        select: { id: true, nome: true, email: true, role: true, clienteId: true },
      })
    })
    await setCookieAuth(await criarToken(user))
    return authJson({ success: true, user }, 201)
  } catch (error) { return authFailure(error) }
}
