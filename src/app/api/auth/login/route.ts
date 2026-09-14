import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { criarToken, setCookieAuth, bcrypt } from '@/lib/auth-cookies'
import { loginSchema, fieldErrors } from '@/lib/auth-validation'
import { authFailure, authJson, authReady, limitAuthAttempts, readAuthBody } from '@/lib/auth-http'

export async function POST(req: NextRequest) {
  try {
    const parsed = loginSchema.safeParse(await readAuthBody(req))
    if (!parsed.success) return authJson({ success: false, error: 'Revise os campos indicados.', fields: fieldErrors(parsed.error) }, 400)
    authReady()
    const { email, senha, lembrar } = parsed.data
    const limited = await limitAuthAttempts('login', email)
    if (limited) return limited
    const user = await db.user.findUnique({ where: { email } })
    // Hash de comparação público, sem conta associada, para reduzir diferença de tempo.
    const fallbackHash = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'
    const valid = await bcrypt.compare(senha, user?.senha || fallbackHash)
    if (!user || !user.ativo || !valid || !['ADMIN', 'CLIENTE'].includes(user.role)) {
      return authJson({ success: false, error: 'E-mail ou senha incorretos.' }, 401)
    }
    await setCookieAuth(await criarToken(user, lembrar), lembrar)
    return authJson({
      success: true,
      user: { id: user.id, nome: user.nome, email: user.email, role: user.role, clienteId: user.clienteId },
    })
  } catch (error) { return authFailure(error) }
}
