import { NextRequest } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { AuthError, authFailure, authJson, authReady } from '@/lib/auth-http'
import { integrationBridgeRequest } from '@/lib/integration-bridge'
import { db } from '@/lib/db'

async function requireAdmin() {
  authReady()
  const user = await getUsuarioLogado()
  if (!user) throw new AuthError('Entre na sua conta para continuar.', 401)
  if (user.role !== 'ADMIN') {
    throw new AuthError('Acesso permitido apenas à administração.', 403)
  }
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

    return authJson({ success: true, users })
  } catch (error) {
    return authFailure(error)
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()

    const body = await req.json().catch(() => null)
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''
    const rawCliCod = body?.siggmaCliCod

    if (!userId) throw new AuthError('Conta do cliente é obrigatória.', 400)

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, nome: true, email: true },
    })
    if (!user || user.role !== 'CLIENTE') {
      throw new AuthError('Conta de cliente não encontrada.', 404)
    }

    if (rawCliCod === null || rawCliCod === '' || rawCliCod === undefined) {
      await db.user.update({
        where: { id: userId },
        data: { siggmaCliCod: null },
      })
      return authJson({ success: true, linked: false })
    }

    const siggmaCliCod = Number.parseInt(String(rawCliCod), 10)
    if (!Number.isFinite(siggmaCliCod) || siggmaCliCod < 1) {
      throw new AuthError('Código do cliente Siggma inválido.', 400)
    }

    const official = await integrationBridgeRequest<{
      ok: boolean
      data: { id: number; nome?: string | null }
    }>(`/api/zetta/clientes/${siggmaCliCod}`)

    if (!official.ok || !official.data?.id) {
      throw new AuthError('Cliente não encontrado no Zetta.', 404)
    }

    const alreadyLinked = await db.user.findFirst({
      where: {
        siggmaCliCod,
        NOT: { id: userId },
      },
      select: { id: true, nome: true, email: true },
    })
    if (alreadyLinked) {
      throw new AuthError(
        `O cliCod ${siggmaCliCod} já está vinculado a outra conta do portal.`,
        409
      )
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: { siggmaCliCod },
      select: {
        id: true,
        nome: true,
        email: true,
        siggmaCliCod: true,
      },
    })

    return authJson({
      success: true,
      linked: true,
      user: updated,
      zettaClient: {
        id: official.data.id,
        nome: official.data.nome || null,
      },
    })
  } catch (error) {
    return authFailure(error)
  }
}
