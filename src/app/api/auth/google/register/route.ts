import { randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { bcrypt, COOKIE_NAME, criarToken } from '@/lib/auth-cookies'
import { AuthError, authFailure, authJson, authReady, limitAuthAttempts, readAuthBody } from '@/lib/auth-http'
import { fieldErrors } from '@/lib/auth-validation'
import { GOOGLE_PENDING_COOKIE, googleCookieOptions, readGooglePending } from '@/lib/google-oauth'
import { ensurePortalUserSiggmaLink, validCpfCnpj } from '@/lib/siggma/customer'

// O Google autentica e-mail/identidade; dados de contato e fiscais ainda são obrigatórios.
const schema = z.object({
  telefone: z.string().max(25).transform(v => v.replace(/\D/g, ''))
    .refine(v => /^[1-9]{2}\d{8,9}$/.test(v), 'Informe o telefone com DDD.'),
  cpfCnpj: z.string().max(18).transform(v => v.replace(/\D/g, ''))
    .refine(v => validCpfCnpj(v), 'Informe um CPF ou CNPJ válido.'),
  endereco: z.string().trim().max(240).optional(),
  cep: z.string().max(10).transform(v => v.replace(/\D/g, ''))
    .refine(v => !v || v.length === 8, 'Informe um CEP válido.').optional(),
}).strict()

export async function POST(req: NextRequest) {
  try {
    authReady()
    const pending = readGooglePending(req.cookies.get(GOOGLE_PENDING_COOKIE)?.value)
    if (!pending) throw new AuthError('A validação do Google expirou. Recomece o cadastro.', 410)
    const parsed = schema.safeParse(await readAuthBody(req))
    if (!parsed.success) return authJson({ success: false, error: 'Revise os dados do cadastro.', fields: fieldErrors(parsed.error) }, 400)
    const limited = await limitAuthAttempts('google-register', pending.sub, 5, 15)
    if (limited) return limited
    const data = parsed.data
    const secretHash = await bcrypt.hash(randomBytes(40).toString('hex'), 12)

    const user = await db.$transaction(async tx => {
      const previousUser = await tx.user.findFirst({
        where: { OR: [{ googleSub: pending.sub }, { email: { equals: pending.email, mode: 'insensitive' } }] },
        select: { id: true },
      })
      const previousClient = await tx.cliente.findFirst({
        where: {
          OR: [
            { email: { equals: pending.email, mode: 'insensitive' } },
            { cpfCnpj: data.cpfCnpj },
          ],
        },
        select: { id: true },
      })
      if (previousUser || previousClient) {
        throw new AuthError('Já existe um cadastro com estes dados. Entre com sua conta atual e vincule o Google.', 409)
      }
      return tx.user.create({
        data: {
          nome: pending.nome, email: pending.email, googleSub: pending.sub,
          senha: secretHash, role: 'CLIENTE',
          cliente: {
            create: {
              nome: pending.nome, email: pending.email, telefone: data.telefone,
              cpfCnpj: data.cpfCnpj, endereco: data.endereco || null, cep: data.cep || null,
            },
          },
        },
        select: { id: true, nome: true, email: true, role: true, clienteId: true },
      })
    })

    try { await ensurePortalUserSiggmaLink(user.id) }
    catch { console.error('[google-register] Sincronização de cliente pendente.') }

    const response = authJson({ success: true, user }, 201)
    response.cookies.set(COOKIE_NAME, await criarToken(user, true), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
    })
    response.cookies.set(GOOGLE_PENDING_COOKIE, '', { ...googleCookieOptions, maxAge: 0 })
    return response
  } catch (error) {
    return authFailure(error)
  }
}
