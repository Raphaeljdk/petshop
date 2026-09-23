import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bcrypt } from '@/lib/auth-cookies'
import { AuthError, authFailure, authJson, authReady, limitAuthAttempts, readAuthBody } from '@/lib/auth-http'
import { passwordSchema } from '@/lib/auth-validation'
import { acceptClientInvitation, hashInvitation, officialInvitationClient } from '@/lib/client-invitations'

const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/)
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('verify'), token: tokenSchema }).strict(),
  z.object({ action: z.literal('accept'), token: tokenSchema, senha: passwordSchema, confirmarSenha: z.string().max(72) }).strict(),
])
export async function POST(req: NextRequest) {
  try {
    authReady()
    const parsed = schema.safeParse(await readAuthBody(req))
    if (!parsed.success) throw new AuthError('Confira o convite e use uma senha de 10 a 72 caracteres com letra e número.')
    const data = parsed.data
    const limited = await limitAuthAttempts('client-activation', hashInvitation(data.token), 15, 15)
    if (limited) return limited
    const invitation = await db.clientInvitation.findUnique({ where: { tokenHash: hashInvitation(data.token) } })
    if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) throw new AuthError('Convite inválido, expirado ou já utilizado. Peça um novo convite à loja.', 410)
    if (data.action === 'verify') return authJson({ success: true, email: invitation.email, expiresAt: invitation.expiresAt })
    if (data.senha !== data.confirmarSenha) throw new AuthError('As senhas não coincidem.')
    // Recheck the destination at activation; an outdated email cannot claim the record.
    const official = await officialInvitationClient(invitation.siggmaCliCod)
    if (official.email !== invitation.email) throw new AuthError('O cadastro mudou. Peça um novo convite à loja.', 409)
    await acceptClientInvitation(data.token, await bcrypt.hash(data.senha, 12))
    return authJson({ success: true }, 201)
  } catch (error) { return authFailure(error) }
}
