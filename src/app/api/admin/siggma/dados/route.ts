import { NextRequest } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { AuthError, authFailure, authJson, authReady } from '@/lib/auth-http'
import { siggma } from '@/lib/siggma/service'

async function requireAdmin() {
  authReady()
  const user = await getUsuarioLogado()
  if (!user) throw new AuthError('Entre na sua conta para continuar.', 401)
  if (user.role !== 'ADMIN') throw new AuthError('Acesso permitido apenas à administração.', 403)
}

function intParam(value: string | null, fallback?: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) throw new AuthError('Parâmetro numérico inválido.')
  return parsed
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const recurso = req.nextUrl.searchParams.get('recurso')
    const pagina = intParam(req.nextUrl.searchParams.get('pagina'), 1)
    const since = req.nextUrl.searchParams.get('since') || undefined
    const cliente = intParam(req.nextUrl.searchParams.get('cliente'))
    const animal = intParam(req.nextUrl.searchParams.get('animal'))

    if (recurso === 'clientes') {
      const data = await siggma.clientes.listar({
        pagina,
        limit: 100,
        since,
        q: req.nextUrl.searchParams.get('q') || undefined,
      })
      return authJson({ success: true, source: 'siggma', data })
    }

    if (recurso === 'animais') {
      const data = await siggma.animais.listar({
        pagina,
        cliente,
        since,
        q: req.nextUrl.searchParams.get('q') || undefined,
      })
      return authJson({ success: true, source: 'siggma', data })
    }

    if (recurso === 'vacinas') {
      const data = await siggma.vacinas.listar({ pagina, cliente, animal, since })
      return authJson({ success: true, source: 'siggma', data })
    }

    if (recurso === 'atendimentos') {
      const data = await siggma.atendimentos.listar({
        pagina,
        cliente,
        animal,
        since,
        tipo: req.nextUrl.searchParams.get('tipo') || undefined,
        status: req.nextUrl.searchParams.get('status') || undefined,
      })
      return authJson({ success: true, source: 'siggma', data })
    }

    if (recurso === 'produtos') {
      const ativo = req.nextUrl.searchParams.get('ativo')
      const data = await siggma.produtos.listar({
        pagina,
        since,
        nome: req.nextUrl.searchParams.get('q') || undefined,
        ativo: ativo === 'true' || ativo === 'false' ? ativo : undefined,
      })
      return authJson({ success: true, source: 'siggma', data })
    }

    throw new AuthError('Informe recurso=clientes, animais, vacinas, atendimentos ou produtos.')
  } catch (error) {
    return authFailure(error)
  }
}
