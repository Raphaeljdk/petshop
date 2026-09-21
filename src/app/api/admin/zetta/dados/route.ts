import { NextRequest } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { AuthError, authFailure, authJson, authReady } from '@/lib/auth-http'
import { integrationBridgeRequest } from '@/lib/integration-bridge'

type Recurso = 'clientes' | 'animais' | 'produtos' | 'atendimentos'

type BridgePage = {
  ok: boolean
  page: number
  limit: number
  total: number
  data: Array<Record<string, unknown>>
}

async function requireAdmin() {
  authReady()
  const user = await getUsuarioLogado()
  if (!user) throw new AuthError('Entre na sua conta para continuar.', 401)
  if (user.role !== 'ADMIN') {
    throw new AuthError('Acesso permitido apenas à administração.', 403)
  }
}

function positiveInt(value: string | null, fallback: number, max: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new AuthError('Parâmetro numérico inválido.', 400)
  }
  return Math.min(parsed, max)
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const recurso = req.nextUrl.searchParams.get('recurso') as Recurso | null
    if (!recurso || !['clientes', 'animais', 'produtos', 'atendimentos'].includes(recurso)) {
      throw new AuthError('Informe recurso=clientes, animais, produtos ou atendimentos.', 400)
    }

    const page = positiveInt(req.nextUrl.searchParams.get('page'), 1, 1_000_000)
    const limit = positiveInt(req.nextUrl.searchParams.get('limit'), 25, 100)
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })

    const q = req.nextUrl.searchParams.get('q')?.trim()
    const cliente = req.nextUrl.searchParams.get('cliente')?.trim()
    const animal = req.nextUrl.searchParams.get('animal')?.trim()
    const since = req.nextUrl.searchParams.get('since')?.trim()

    if (q && (recurso === 'clientes' || recurso === 'produtos')) query.set('q', q)
    if (cliente && (recurso === 'animais' || recurso === 'atendimentos')) query.set('cliente', cliente)
    if (animal && recurso === 'atendimentos') query.set('animal', animal)
    if (since) query.set('since', since)

    const result = await integrationBridgeRequest<BridgePage>(
      `/api/zetta/${recurso}?${query.toString()}`
    )

    return authJson({
      success: true,
      source: 'zetta-bridge',
      resource: recurso,
      ...result,
    })
  } catch (error) {
    return authFailure(error)
  }
}
