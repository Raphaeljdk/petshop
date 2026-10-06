import { getUsuarioLogado } from '@/lib/auth-cookies'
import { AuthError, authFailure, authJson, authReady } from '@/lib/auth-http'
import { integrationBridgeRequest } from '@/lib/integration-bridge'
import { db } from '@/lib/db'

type ZettaPage = {
  ok: boolean
  page: number
  limit: number
  total: number
  data: Array<{ id: number; nome?: string | null }>
}

async function requireAdmin() {
  authReady()
  const user = await getUsuarioLogado()
  if (!user) throw new AuthError('Entre na sua conta para continuar.', 401)
  if (user.role !== 'ADMIN') {
    throw new AuthError('Acesso permitido apenas à administração.', 403)
  }
}

function normalizeName(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

async function fetchAllZettaClients() {
  const first = await integrationBridgeRequest<ZettaPage>('/api/zetta/clientes?page=1&limit=100')
  const rows = [...(first.data || [])]
  const pages = Math.max(1, Math.ceil((first.total || rows.length) / 100))

  for (let page = 2; page <= pages; page += 1) {
    const current = await integrationBridgeRequest<ZettaPage>(
      `/api/zetta/clientes?page=${page}&limit=100`
    )
    rows.push(...(current.data || []))
  }

  return rows
}

export async function GET() {
  try {
    await requireAdmin()

    const users = await db.user.findMany({
      where: { role: 'CLIENTE' },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        email: true,
        clienteId: true,
        siggmaCliCod: true,
        ativo: true,
      },
    })

    return authJson({
      success: true,
      users,
      linked: users.filter((user) => user.siggmaCliCod).length,
      pending: users.filter((user) => !user.siggmaCliCod).length,
    })
  } catch (error) {
    return authFailure(error)
  }
}

export async function POST() {
  try {
    await requireAdmin()

    const [users, zettaClients] = await Promise.all([
      db.user.findMany({
        where: { role: 'CLIENTE' },
        orderBy: { nome: 'asc' },
        select: {
          id: true,
          nome: true,
          email: true,
          siggmaCliCod: true,
        },
      }),
      fetchAllZettaClients(),
    ])

    const zettaByName = new Map<string, Array<{ id: number; nome?: string | null }>>()
    for (const client of zettaClients) {
      const key = normalizeName(client.nome)
      if (!key || !Number.isFinite(Number(client.id))) continue
      const list = zettaByName.get(key) || []
      list.push(client)
      zettaByName.set(key, list)
    }

    const portalNameCount = new Map<string, number>()
    for (const user of users) {
      const key = normalizeName(user.nome)
      if (!key) continue
      portalNameCount.set(key, (portalNameCount.get(key) || 0) + 1)
    }

    const occupied = new Set(
      users
        .map((user) => user.siggmaCliCod)
        .filter((value): value is number => typeof value === 'number' && value > 0)
    )

    const matches: Array<{ userId: string; siggmaCliCod: number }> = []
    let ambiguous = 0
    let notFound = 0

    for (const user of users) {
      if (user.siggmaCliCod) continue
      const key = normalizeName(user.nome)
      const candidates = key ? zettaByName.get(key) || [] : []

      if (!key || candidates.length === 0) {
        notFound += 1
        continue
      }

      if (portalNameCount.get(key) !== 1 || candidates.length !== 1) {
        ambiguous += 1
        continue
      }

      const siggmaCliCod = Number(candidates[0].id)
      if (occupied.has(siggmaCliCod)) {
        ambiguous += 1
        continue
      }

      occupied.add(siggmaCliCod)
      matches.push({ userId: user.id, siggmaCliCod })
    }

    if (matches.length > 0) {
      await db.$transaction(
        matches.map((match) =>
          db.user.update({
            where: { id: match.userId },
            data: { siggmaCliCod: match.siggmaCliCod },
          })
        )
      )
    }

    return authJson({
      success: true,
      linkedNow: matches.length,
      linkedTotal: users.filter((user) => user.siggmaCliCod).length + matches.length,
      pending: users.filter((user) => !user.siggmaCliCod).length - matches.length,
      ambiguous,
      notFound,
      rule: 'nome_exato_normalizado_unico',
    })
  } catch (error) {
    return authFailure(error)
  }
}
