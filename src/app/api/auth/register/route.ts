import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { bcrypt, criarToken, setCookieAuth } from '@/lib/auth-cookies'
import { clientRegistrationSchema, fieldErrors } from '@/lib/auth-validation'
import { AuthError, authFailure, authJson, authReady, limitAuthAttempts, readAuthBody } from '@/lib/auth-http'

export async function POST(req: NextRequest) {
  try {
    const parsed = clientRegistrationSchema.safeParse(await readAuthBody(req))
    if (!parsed.success) return authJson({ success: false, error: 'Revise os campos indicados.', fields: fieldErrors(parsed.error) }, 400)
    authReady()
    const { nome, email, senha, telefone, endereco, cep } = parsed.data
    const limited = await limitAuthAttempts('register', email, 5, 15)
    if (limited) return limited
    const senhaHash = await bcrypt.hash(senha, 12)
    const user = await db.$transaction(async tx => {
      // Um e-mail digitado não comprova a identidade de um cliente antigo.
      // Nunca vincular ou sobrescrever um prontuário existente pelo cadastro público.
      if (await tx.cliente.findUnique({ where: { email }, select: { id: true } })) {
        throw new AuthError('Já existe um atendimento com este e-mail. Procure a equipe para habilitar seu acesso.', 409)
      }
      return tx.user.create({
        data: {
          nome, email, senha: senhaHash, role: 'CLIENTE',
          cliente: { create: { nome, email, telefone, endereco: endereco || null, cep: cep || null } },
        },
        select: { id: true, nome: true, email: true, role: true, clienteId: true },
      })
    })
    await setCookieAuth(await criarToken(user))
    return authJson({ success: true, user }, 201)
  } catch (error) { return authFailure(error) }
}
