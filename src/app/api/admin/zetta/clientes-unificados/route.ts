import { authFailure, authJson, AuthError, authReady } from '@/lib/auth-http'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { db } from '@/lib/db'
import { integrationBridgeRequest } from '@/lib/integration-bridge'

type BridgePage<T> = {
  ok: boolean
  page: number
  limit: number
  total: number
  data: T[]
}

type ZettaCliente = {
  id: number
  nome?: string | null
  apelido?: string | null
  email?: string | null
  telefone?: string | null
  celular?: string | null
  ativo?: boolean | null
  dataAtualizacao?: string | null
}

type ZettaAnimal = {
  id: number
  clienteId: number
  nome?: string | null
  especie?: string | null
  raca?: string | null
  sexo?: string | null
  peso?: number | string | null
  status?: string | null
  dataNascimento?: string | null
  dataAtualizacao?: string | null
}

async function requireAdmin() {
  authReady()
  const user = await getUsuarioLogado()
  if (!user) throw new AuthError('Entre na sua conta para continuar.', 401)
  if (user.role !== 'ADMIN') {
    throw new AuthError('Acesso permitido apenas à administração.', 403)
  }
}

async function fetchAll<T>(path: string) {
  const first = await integrationBridgeRequest<BridgePage<T>>(`${path}?page=1&limit=100`)
  const rows = [...(first.data || [])]
  const pages = Math.max(1, Math.ceil((first.total || rows.length) / 100))

  for (let page = 2; page <= pages; page += 1) {
    const current = await integrationBridgeRequest<BridgePage<T>>(
      `${path}?page=${page}&limit=100`
    )
    rows.push(...(current.data || []))
  }

  return {
    total: first.total || rows.length,
    data: rows,
  }
}

export async function GET() {
  try {
    await requireAdmin()

    const [clientesResult, animaisResult, portalUsers] = await Promise.all([
      fetchAll<ZettaCliente>('/api/zetta/clientes'),
      fetchAll<ZettaAnimal>('/api/zetta/animais'),
      db.user.findMany({
        where: { role: 'CLIENTE' },
        orderBy: { nome: 'asc' },
        select: {
          id: true,
          nome: true,
          email: true,
          ativo: true,
          siggmaCliCod: true,
          clienteId: true,
        },
      }),
    ])

    const petsByClient = new Map<number, ZettaAnimal[]>()
    for (const pet of animaisResult.data) {
      if (!Number.isFinite(Number(pet.clienteId))) continue
      const cliCod = Number(pet.clienteId)
      const list = petsByClient.get(cliCod) || []
      list.push(pet)
      petsByClient.set(cliCod, list)
    }

    const portalByClient = new Map<number, (typeof portalUsers)[number]>()
    for (const user of portalUsers) {
      if (!user.siggmaCliCod) continue
      portalByClient.set(user.siggmaCliCod, user)
    }

    const clientes = clientesResult.data.map((cliente) => ({
      ...cliente,
      pets: (petsByClient.get(Number(cliente.id)) || []).sort((a, b) =>
        String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
      ),
      portal: portalByClient.get(Number(cliente.id)) || null,
    }))

    return authJson({
      success: true,
      source: 'zetta',
      totalClientes: clientesResult.total,
      totalPets: animaisResult.total,
      contasPortal: portalUsers.length,
      contasVinculadas: portalUsers.filter((user) => user.siggmaCliCod).length,
      clientes,
    })
  } catch (error) {
    return authFailure(error)
  }
}
