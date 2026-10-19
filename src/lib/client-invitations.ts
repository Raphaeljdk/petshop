import { createHash, randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { AuthError } from '@/lib/auth-http'
import { emailSchema } from '@/lib/auth-validation'

export const hashInvitation = (token: string) => createHash('sha256').update(token).digest('hex')
export function invitationMailConfig() {
  const key = process.env.RESEND_API_KEY?.trim()
  const from = process.env.INVITATION_EMAIL_FROM?.trim()
  const replyTo = process.env.INVITATION_EMAIL_REPLY_TO?.trim()
  const raw = process.env.APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim()
  let origin = ''
  try {
    const url = new URL(raw || '')
    if (url.protocol === 'https:' && !url.username && !url.password) origin = url.origin
  } catch {}
  return { key, from, replyTo, origin, configured: Boolean(key && from && origin) }
}

// ERP local é a fonte oficial dos cadastros: nenhuma chamada ao Zetta/Siggma.
export async function officialInvitationClient(id: string) {
  const client = await db.cliente.findUnique({ where: { id }, select: { id: true, nome: true, email: true, telefone: true } })
  const email = emailSchema.safeParse(client?.email)
  if (!client || !email.success) throw new AuthError('Cadastre um e-mail válido no cliente local antes de convidar.', 409)
  return { clienteId: client.id, nome: client.nome.trim(), email: email.data, telefone: client.telefone }
}

export async function issueClientInvitation(target: Awaited<ReturnType<typeof officialInvitationClient>>, createdById: string) {
  const token = randomBytes(32).toString('hex')
  const now = new Date()
  const data = {
    clienteId: target.clienteId, nome: target.nome, email: target.email, telefone: target.telefone,
    createdById, tokenHash: hashInvitation(token), issuedAt: now,
    expiresAt: new Date(now.getTime() + 48 * 60 * 60_000), usedAt: null, revokedAt: null,
    emailStatus: 'pending', providerId: null,
  }
  const invitation = await db.$transaction(async tx => {
    const client = await tx.cliente.findUnique({ where: { id: target.clienteId }, select: { email: true } })
    if (!client || client.email?.toLowerCase() !== target.email) throw new AuthError('O cadastro foi alterado. Confira os dados novamente.', 409)
    const account = await tx.user.findFirst({
      where: { OR: [{ clienteId: target.clienteId }, { email: { equals: target.email, mode: 'insensitive' } }] },
      select: { id: true },
    })
    if (account) throw new AuthError('Cliente ou e-mail já possui acesso ao portal.', 409)
    const previous = await tx.clientInvitation.findUnique({ where: { clienteId: target.clienteId } })
    if (previous && previous.issuedAt.getTime() > now.getTime() - 60_000) throw new AuthError('Aguarde um minuto antes de reenviar o convite.', 429)
    return tx.clientInvitation.upsert({ where: { clienteId: target.clienteId }, create: data, update: data })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  return { invitation, token }
}

export async function acceptClientInvitation(token: string, senhaHash: string) {
  const tokenHash = hashInvitation(token)
  return db.$transaction(async tx => {
    const invitation = await tx.clientInvitation.findUnique({ where: { tokenHash } })
    const now = new Date()
    if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt <= now) throw new AuthError('Convite inválido, expirado ou já utilizado. Peça um novo convite à loja.', 410)
    if (!invitation.clienteId) throw new AuthError('Convite antigo. Solicite um novo convite vinculado ao cadastro local.', 410)
    const client = await tx.cliente.findUnique({ where: { id: invitation.clienteId }, select: { nome: true, email: true } })
    if (!client || client.email?.trim().toLowerCase() !== invitation.email) throw new AuthError('O e-mail do cliente foi alterado. Peça um novo convite.', 409)
    if (await tx.user.findFirst({
      where: { OR: [{ clienteId: invitation.clienteId }, { email: { equals: invitation.email, mode: 'insensitive' } }] }, select: { id: true },
    })) throw new AuthError('Já existe uma conta para este cadastro.', 409)
    const claimed = await tx.clientInvitation.updateMany({
      where: { id: invitation.id, tokenHash, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    })
    if (claimed.count !== 1) throw new AuthError('Este convite não está mais disponível.', 410)
    return tx.user.create({ data: {
      nome: client.nome, email: invitation.email, senha: senhaHash,
      role: 'CLIENTE', clienteId: invitation.clienteId,
    }, select: { id: true } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function sendClientInvitation(invitation: { nome: string; email: string; tokenHash: string }, token: string) {
  const config = invitationMailConfig()
  if (!config.configured) throw new AuthError('Configure RESEND_API_KEY, INVITATION_EMAIL_FROM e APP_URL (HTTPS) antes de enviar.', 503)
  const link = `${config.origin}/ativar-conta#convite=${token}`
  const text = `Olá, ${invitation.nome}!\n\nA Matilha Prado convida você a acessar o portal do cliente.\n\nConfirme seu e-mail e defina sua senha neste link individual:\n${link}\n\nO link vale por 48 horas e só pode ser usado uma vez. Não compartilhe este convite.\n\nEquipe Matilha Prado`
  const payload: { from: string; to: string[]; subject: string; text: string; reply_to?: string } = {
    from: config.from!, to: [invitation.email], subject: 'Seu acesso ao portal Matilha Prado', text,
  }
  if (config.replyTo) payload.reply_to = config.replyTo
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: {
      Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json',
      'Idempotency-Key': `client-invitation-${invitation.tokenHash}`,
    }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || typeof result?.id !== 'string') throw new AuthError('O serviço não confirmou o envio. Confira o painel de e-mails antes de tentar novamente.', 502)
  return result.id as string
}
