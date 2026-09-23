import { createHash, randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { AuthError } from '@/lib/auth-http'
import { emailSchema } from '@/lib/auth-validation'
import { integrationBridgeRequest } from '@/lib/integration-bridge'

export const hashInvitation = (token: string) => createHash('sha256').update(token).digest('hex')
export function invitationMailConfig() {
  const key = process.env.RESEND_API_KEY?.trim()
  const from = process.env.INVITATION_EMAIL_FROM?.trim()
  const raw = process.env.APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim()
  let origin = ''
  try {
    const url = new URL(raw || '')
    if (url.protocol === 'https:' && !url.username && !url.password) origin = url.origin
  } catch {}
  return { key, from, origin, configured: Boolean(key && from && origin) }
}

export async function officialInvitationClient(id: number) {
  const response = await integrationBridgeRequest<{ ok: boolean; data: { id: number; nome?: string; email?: string; telefone?: string; celular?: string; ativo?: boolean } }>(`/api/zetta/clientes/${id}`)
  const client = response.data
  const email = emailSchema.safeParse(client?.email)
  if (!response.ok || Number(client?.id) !== id || client.ativo === false || !email.success) {
    throw new AuthError('O cadastro precisa estar ativo e ter um único e-mail válido na loja.', 409)
  }
  return { siggmaCliCod: id, nome: client.nome?.trim() || 'Cliente Matilha Prado', email: email.data, telefone: client.celular || client.telefone || '' }
}

export async function issueClientInvitation(target: Awaited<ReturnType<typeof officialInvitationClient>>, createdById: string) {
  const token = randomBytes(32).toString('hex')
  const now = new Date()
  const data = { ...target, createdById, tokenHash: hashInvitation(token), issuedAt: now, expiresAt: new Date(now.getTime() + 48 * 60 * 60_000), usedAt: null, revokedAt: null, emailStatus: 'pending', providerId: null }
  const invitation = await db.$transaction(async tx => {
    const account = await tx.user.findFirst({ where: { OR: [{ siggmaCliCod: target.siggmaCliCod }, { email: { equals: target.email, mode: 'insensitive' } }] }, select: { id: true } })
    if (account) throw new AuthError('Este cliente ou e-mail já possui acesso. O convite não altera contas existentes.', 409)
    // Do not claim unrelated local records solely because their email matches.
    if (await tx.cliente.findFirst({ where: { email: { equals: target.email, mode: 'insensitive' } }, select: { id: true } })) {
      throw new AuthError('Já existe um cadastro local com este e-mail. Revise o vínculo antes de convidar.', 409)
    }
    const previous = await tx.clientInvitation.findUnique({ where: { siggmaCliCod: target.siggmaCliCod } })
    if (previous && previous.issuedAt.getTime() > now.getTime() - 60_000) throw new AuthError('Aguarde um minuto antes de reenviar o convite.', 429)
    return tx.clientInvitation.upsert({ where: { siggmaCliCod: target.siggmaCliCod }, create: data, update: data })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  return { invitation, token }
}

export async function acceptClientInvitation(token: string, senhaHash: string) {
  const tokenHash = hashInvitation(token)
  return db.$transaction(async tx => {
    const invitation = await tx.clientInvitation.findUnique({ where: { tokenHash } })
    const now = new Date()
    if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt <= now) throw new AuthError('Convite inválido, expirado ou já utilizado. Peça um novo convite à loja.', 410)
    const claimed = await tx.clientInvitation.updateMany({ where: { id: invitation.id, tokenHash, usedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })
    if (claimed.count !== 1) throw new AuthError('Este convite não está mais disponível.', 410)
    if (await tx.user.findFirst({ where: { OR: [{ siggmaCliCod: invitation.siggmaCliCod }, { email: { equals: invitation.email, mode: 'insensitive' } }] }, select: { id: true } })) throw new AuthError('Já existe uma conta para este cadastro. Entre ou fale com a loja.', 409)
    if (await tx.cliente.findFirst({ where: { email: { equals: invitation.email, mode: 'insensitive' } }, select: { id: true } })) throw new AuthError('Seu cadastro precisa ser conferido pela loja antes da ativação.', 409)
    // The signed-in account and ERP link are created together, never supplied by the browser.
    return tx.user.create({ data: {
      nome: invitation.nome, email: invitation.email, senha: senhaHash, role: 'CLIENTE', siggmaCliCod: invitation.siggmaCliCod,
      cliente: { create: { nome: invitation.nome, email: invitation.email, telefone: invitation.telefone } },
    }, select: { id: true } })
  })
}

export async function sendClientInvitation(invitation: { nome: string; email: string; tokenHash: string }, token: string) {
  const config = invitationMailConfig()
  if (!config.configured) throw new AuthError('Configure RESEND_API_KEY, INVITATION_EMAIL_FROM e APP_URL (HTTPS) antes de enviar.', 503)
  // Fragment is not sent in HTTP requests, access logs or referrers.
  const link = `${config.origin}/ativar-conta#convite=${token}`
  const text = `Olá, ${invitation.nome}!\n\nA Matilha Prado convida você a acessar o portal do cliente para acompanhar seus pets e atendimentos.\n\nConfirme seu e-mail e defina sua senha neste link individual:\n${link}\n\nO link vale por 48 horas e só pode ser usado uma vez. Não compartilhe este convite.\n\nSe você não reconhece este cadastro, ignore o e-mail e avise a loja.\n\nEquipe Matilha Prado`
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `client-invitation-${invitation.tokenHash}` }, body: JSON.stringify({ from: config.from, to: [invitation.email], subject: 'Seu acesso ao portal Matilha Prado', text }), signal: AbortSignal.timeout(10_000) })
  const result = await response.json().catch(() => null)
  if (!response.ok || typeof result?.id !== 'string') throw new AuthError('O serviço não confirmou o envio. Confira o painel de e-mails antes de tentar novamente.', 502)
  return result.id as string
}
