import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { bcrypt, criarToken, setCookieAuth } from '@/lib/auth-cookies'
import { adminRegistrationSchema, fieldErrors } from '@/lib/auth-validation'
import { AuthError, authFailure, authJson, authReady, limitAuthAttempts, readAuthBody } from '@/lib/auth-http'

const PRIMARY_ADMIN_EMAIL = 'matilhaprado@gmail.com'

function secureCodeEquals(received: string, expected: string): boolean {
  const receivedHash = createHash('sha256').update(received).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(receivedHash, expectedHash)
}

function assertBootstrapCode(invite: string): void {
  const setupCode = process.env.ADMIN_BOOTSTRAP_CODE?.trim().toLowerCase() || ''
  if (!/^[a-f0-9]{64}$/.test(setupCode)) {
    throw new AuthError('A ativação inicial do administrador ainda não foi configurada no servidor.', 503)
  }
  if (!secureCodeEquals(invite.toLowerCase(), setupCode)) {
    throw new AuthError('Código de ativação do administrador inválido.', 403)
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = adminRegistrationSchema.safeParse(await readAuthBody(req))
    if (!parsed.success) return authJson({ success: false, error: 'Revise os campos indicados.', fields: fieldErrors(parsed.error) }, 400)
    authReady()
    const { nome, email, senha, convite } = parsed.data
    const limited = await limitAuthAttempts('register-admin', email, 5, 15)
    if (limited) return limited

    // O bootstrap do e-mail oficial é idempotente. Se a primeira criação já ocorreu,
    // repetir o mesmo código e a mesma senha apenas recupera a sessão, sem criar outra conta.
    if (email === PRIMARY_ADMIN_EMAIL) {
      assertBootstrapCode(convite)
      const existingPrimary = await db.user.findUnique({
        where: { email: PRIMARY_ADMIN_EMAIL },
        select: { id: true, nome: true, email: true, senha: true, role: true, clienteId: true, ativo: true },
      })
      if (existingPrimary) {
        if (existingPrimary.role !== 'ADMIN' || !existingPrimary.ativo) {
          throw new AuthError('O e-mail oficial já está associado a uma conta que precisa de revisão pela administração.', 409)
        }
        if (!(await bcrypt.compare(senha, existingPrimary.senha))) {
          throw new AuthError('A conta administrativa já foi criada. Use a senha definida na primeira tentativa ou entre pela tela de login.', 409)
        }
        const user = {
          id: existingPrimary.id,
          nome: existingPrimary.nome,
          email: existingPrimary.email,
          role: existingPrimary.role,
          clienteId: existingPrimary.clienteId,
        }
        await setCookieAuth(await criarToken(user))
        return authJson({ success: true, user, existing: true }, 200)
      }
    }

    const tokenHash = createHash('sha256').update(convite).digest('hex')
    const senhaHash = await bcrypt.hash(senha, 12)
    const user = await db.$transaction(async tx => {
      const now = new Date()
      const existingAdmin = await tx.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } })

      // Bootstrap do primeiro administrador: somente o e-mail oficial da Matilha Prado,
      // somente enquanto não existir nenhum ADMIN e protegido por um código secreto da Vercel.
      if (!existingAdmin && email === PRIMARY_ADMIN_EMAIL) {
        assertBootstrapCode(convite)
        return tx.user.create({
          data: { nome, email, senha: senhaHash, role: 'ADMIN' },
          select: { id: true, nome: true, email: true, role: true, clienteId: true },
        })
      }

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
