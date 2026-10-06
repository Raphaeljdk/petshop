import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { criarToken, setCookieAuth, bcrypt } from '@/lib/auth-cookies'
import { loginSchema, fieldErrors } from '@/lib/auth-validation'
import { authFailure, authJson, authReady, limitAuthAttempts, readAuthBody } from '@/lib/auth-http'
const fallbackHash =
  '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'

export async function POST(req: NextRequest) {
  try {
    const parsed = loginSchema.safeParse(await readAuthBody(req))
    if (!parsed.success) {
      return authJson(
        { success: false, error: 'Revise os campos indicados.', fields: fieldErrors(parsed.error) },
        400
      )
    }

    authReady()
    const data = parsed.data
    const rateKey =
      data.role === 'CLIENTE' ? `cliente:${data.identificador.replace(/\D/g, '') || data.identificador}` : `equipe:${data.email}`
    const limited = await limitAuthAttempts('login', rateKey)
    if (limited) return limited

    let user: {
      id: string
      nome: string
      email: string
      senha: string
      role: string
      clienteId: string | null
      ativo: boolean
    } | null = null

    if (data.role === 'CLIENTE') {
      const identifier = data.identificador
      const candidates = identifier.includes('@')
        ? await db.user.findMany({
            where: {
              role: 'CLIENTE',
              ativo: true,
              OR: [
                { email: { equals: identifier, mode: 'insensitive' } },
                { cliente: { is: { email: { equals: identifier, mode: 'insensitive' } } } },
              ],
            },
            select: { id: true },
            take: 10,
          })
        : await db.$queryRaw<Array<{ id: string }>>`
            SELECT u."id"
            FROM "User" u
            JOIN "Cliente" c ON c."id" = u."clienteId"
            WHERE u."role" = 'CLIENTE'
              AND u."ativo" = TRUE
              AND regexp_replace(COALESCE(c."telefone", ''), '[^0-9]', '', 'g') = ${identifier.replace(/\D/g, '')}
            LIMIT 10
          `

      for (const row of candidates) {
        const candidate = await db.user.findUnique({
          where: { id: row.id },
          select: {
            id: true,
            nome: true,
            email: true,
            senha: true,
            role: true,
            clienteId: true,
            ativo: true,
          },
        })
        if (!candidate?.ativo || candidate.role !== 'CLIENTE') continue

        if (await bcrypt.compare(data.senha, candidate.senha)) {
          user = candidate
          break
        }
      }

      if (!user) await bcrypt.compare(data.senha, fallbackHash)
    } else {
      const candidate = await db.user.findUnique({
        where: { email: data.email },
        select: {
          id: true,
          nome: true,
          email: true,
          senha: true,
          role: true,
          clienteId: true,
          ativo: true,
        },
      })
      const valid = await bcrypt.compare(data.senha, candidate?.senha || fallbackHash)
      if (
        candidate &&
        candidate.ativo &&
        valid &&
        ['ADMIN', 'KANBAN'].includes(candidate.role)
      ) {
        user = candidate
      }
    }

    if (!user) {
      return authJson(
        {
          success: false,
          error:
            data.role === 'CLIENTE'
              ? 'E-mail, telefone ou senha incorretos.'
              : 'E-mail/usuário ou senha incorretos.',
        },
        401
      )
    }

    await setCookieAuth(await criarToken(user, data.lembrar), data.lembrar)
    return authJson({
      success: true,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        clienteId: user.clienteId,
      },
    })
  } catch (error) {
    return authFailure(error)
  }
}
