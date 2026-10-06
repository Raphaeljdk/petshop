import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { AuthError, assertSameOrigin, authFailure, authJson, authReady, limitAuthAttempts, readAuthBody } from '@/lib/auth-http'
import { emailSchema } from '@/lib/auth-validation'
import { invitationMailConfig, issueClientInvitation, officialInvitationClient, sendClientInvitation } from '@/lib/client-invitations'

async function admin() {
  authReady()
  const user = await getUsuarioLogado()
  if (!user || user.role !== 'ADMIN') throw new AuthError('Acesso permitido apenas à administração.', 403)
  return user
}
export async function GET() {
  try {
    await admin()
    const invitations = await db.clientInvitation.findMany({ orderBy: { issuedAt: 'desc' }, take: 100, select: { id: true, siggmaCliCod: true, nome: true, email: true, expiresAt: true, usedAt: true, revokedAt: true, issuedAt: true, emailStatus: true } })
    return authJson({ success: true, configured: invitationMailConfig().configured, invitations })
  } catch (error) { return authFailure(error) }
}
export async function POST(req: NextRequest) {
  try {
    const user = await admin()
    const body = z.object({ siggmaCliCod: z.number().int().positive(), expectedEmail: emailSchema }).strict().safeParse(await readAuthBody(req))
    if (!body.success) throw new AuthError('Selecione um cliente e confira o e-mail.')
    const mailConfig = invitationMailConfig()
    if (!mailConfig.origin) {
      throw new AuthError('Configure APP_URL ou NEXTAUTH_URL com HTTPS antes de gerar convites.', 503)
    }
    const limited = await limitAuthAttempts('client-invite', user.id, 30, 60)
    if (limited) return limited
    const target = await officialInvitationClient(body.data.siggmaCliCod)
    if (target.email !== body.data.expectedEmail) throw new AuthError('O e-mail do cadastro mudou. Atualize a lista antes de enviar.', 409)
    const { invitation, token } = await issueClientInvitation(target, user.id)
    const activationLink = `${mailConfig.origin}/ativar-conta#convite=${token}`

    if (!mailConfig.configured) {
      await db.clientInvitation.updateMany({
        where: { id: invitation.id, tokenHash: invitation.tokenHash },
        data: { emailStatus: 'manual' },
      })
      return authJson({
        success: true,
        manual: true,
        activationLink,
        message: 'Convite gerado. O envio de e-mail ainda não está configurado; copie o link de ativação e envie ao cliente por um canal privado.',
      }, 201)
    }

    let providerId: string
    try { providerId = await sendClientInvitation(invitation, token) }
    catch {
      await db.clientInvitation.updateMany({ where: { id: invitation.id, tokenHash: invitation.tokenHash }, data: { emailStatus: 'unknown' } })
      return authJson({
        success: true,
        manual: true,
        activationLink,
        message: 'O serviço de e-mail não confirmou o envio. Use o link de ativação abaixo em vez de gerar outro convite.',
      }, 201)
    }
    await db.clientInvitation.updateMany({ where: { id: invitation.id, tokenHash: invitation.tokenHash }, data: { emailStatus: 'accepted', providerId } })
    return authJson({
      success: true,
      manual: false,
      message: 'Convite aceito pelo serviço de e-mail. A entrega na caixa de entrada ainda depende do provedor.',
    }, 201)
  } catch (error) { return authFailure(error) }
}
export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req)
    await admin()
    const id = req.nextUrl.searchParams.get('id')
    if (!id || id.length > 100) throw new AuthError('Convite inválido.')
    const result = await db.clientInvitation.updateMany({ where: { id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } })
    if (!result.count) throw new AuthError('Convite já utilizado ou revogado.', 409)
    return authJson({ success: true })
  } catch (error) { return authFailure(error) }
}
