import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import {
  AuthError,
  assertSameOrigin,
  authFailure,
  authJson,
  authReady,
  readAuthBody,
} from '@/lib/auth-http'
import { normalizarCodigoCupom } from '@/lib/cupons'

const cupomPayloadSchema = z
  .object({
    codigo: z.string().trim().min(3).max(30),
    descricao: z.string().trim().max(240).nullable().optional(),
    tipoDesconto: z.enum(['percentual', 'fixo']),
    valor: z.number().finite().positive(),
    valorMinimo: z.number().finite().min(0).default(0),
    limiteUsos: z.number().int().positive().nullable().optional(),
    limitePorCliente: z.number().int().positive().max(100).default(1),
    inicioEm: z.string().datetime().nullable().optional(),
    fimEm: z.string().datetime().nullable().optional(),
    ativo: z.boolean().default(true),
    influenciadorNome: z.string().trim().max(120).nullable().optional(),
    influenciadorContato: z.string().trim().max(160).nullable().optional(),
    comissaoPercentual: z.number().finite().min(0).max(100).default(0),
  })
  .strict()

const updateSchema = cupomPayloadSchema.partial().extend({ id: z.string().min(1).max(100) }).strict()

async function requireAdmin() {
  authReady()
  const user = await getUsuarioLogado()
  if (!user) throw new AuthError('Entre na sua conta para continuar.', 401)
  if (user.role !== 'ADMIN') throw new AuthError('Acesso permitido apenas à administração.', 403)
  return user
}

function textoOuNulo(value?: string | null) {
  const texto = value?.trim()
  return texto ? texto : null
}

function dataOuNulo(value?: string | null) {
  if (!value) return null
  const data = new Date(value)
  if (Number.isNaN(data.getTime())) throw new AuthError('Data de validade inválida.', 400)
  return data
}

function prepararDados(payload: z.infer<typeof cupomPayloadSchema>) {
  const codigo = normalizarCodigoCupom(payload.codigo)
  if (!/^[A-Z0-9_-]{3,30}$/.test(codigo)) {
    throw new AuthError('O código aceita apenas letras, números, hífen e sublinhado.', 400)
  }
  if (payload.tipoDesconto === 'percentual' && payload.valor > 100) {
    throw new AuthError('O desconto percentual não pode ser maior que 100%.', 400)
  }

  const inicioEm = dataOuNulo(payload.inicioEm)
  const fimEm = dataOuNulo(payload.fimEm)
  if (inicioEm && fimEm && fimEm <= inicioEm) {
    throw new AuthError('A data final deve ser posterior à data inicial.', 400)
  }

  return {
    codigo,
    descricao: textoOuNulo(payload.descricao),
    tipoDesconto: payload.tipoDesconto,
    valor: payload.valor,
    valorMinimo: payload.valorMinimo,
    limiteUsos: payload.limiteUsos ?? null,
    limitePorCliente: payload.limitePorCliente,
    inicioEm,
    fimEm,
    ativo: payload.ativo,
    influenciadorNome: textoOuNulo(payload.influenciadorNome),
    influenciadorContato: textoOuNulo(payload.influenciadorContato),
    comissaoPercentual: payload.comissaoPercentual,
  }
}

function erroPrisma(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AuthError('Já existe um cupom com este código.', 409)
  }
  throw error
}

export async function GET() {
  try {
    await requireAdmin()
    const registros = await db.cupom.findMany({
      orderBy: [{ ativo: 'desc' }, { createdAt: 'desc' }],
      include: {
        usos: {
          where: { venda: { status: 'concluida' } },
          select: {
            desconto: true,
            comissao: true,
            venda: { select: { total: true, createdAt: true } },
          },
        },
      },
    })

    const cupons = registros.map(({ usos, ...cupom }) => ({
      ...cupom,
      metricas: {
        usosAprovados: usos.length,
        vendasGeradas: usos.reduce((acc, uso) => acc + uso.venda.total, 0),
        descontosConcedidos: usos.reduce((acc, uso) => acc + uso.desconto, 0),
        comissaoPendente: usos.reduce((acc, uso) => acc + uso.comissao, 0),
        ultimoUsoEm:
          usos.length > 0
            ? usos.reduce(
                (maisRecente, uso) =>
                  uso.venda.createdAt > maisRecente ? uso.venda.createdAt : maisRecente,
                usos[0].venda.createdAt
              )
            : null,
      },
    }))

    return authJson({ success: true, cupons })
  } catch (error) {
    return authFailure(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req)
    await requireAdmin()
    const parsed = cupomPayloadSchema.safeParse(await readAuthBody(req))
    if (!parsed.success) throw new AuthError('Revise os dados do cupom.', 400)

    try {
      const cupom = await db.cupom.create({ data: prepararDados(parsed.data) })
      return authJson({ success: true, cupom }, 201)
    } catch (error) {
      erroPrisma(error)
    }
  } catch (error) {
    return authFailure(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    assertSameOrigin(req)
    await requireAdmin()
    const parsed = updateSchema.safeParse(await readAuthBody(req))
    if (!parsed.success) throw new AuthError('Revise os dados do cupom.', 400)

    const atual = await db.cupom.findUnique({ where: { id: parsed.data.id } })
    if (!atual) throw new AuthError('Cupom não encontrado.', 404)

    const { id, ...patch } = parsed.data
    const completo: z.infer<typeof cupomPayloadSchema> = {
      codigo: patch.codigo ?? atual.codigo,
      descricao: patch.descricao === undefined ? atual.descricao : patch.descricao,
      tipoDesconto: patch.tipoDesconto ?? (atual.tipoDesconto as 'percentual' | 'fixo'),
      valor: patch.valor ?? atual.valor,
      valorMinimo: patch.valorMinimo ?? atual.valorMinimo,
      limiteUsos: patch.limiteUsos === undefined ? atual.limiteUsos : patch.limiteUsos,
      limitePorCliente: patch.limitePorCliente ?? atual.limitePorCliente,
      inicioEm:
        patch.inicioEm === undefined ? atual.inicioEm?.toISOString() ?? null : patch.inicioEm,
      fimEm: patch.fimEm === undefined ? atual.fimEm?.toISOString() ?? null : patch.fimEm,
      ativo: patch.ativo ?? atual.ativo,
      influenciadorNome:
        patch.influenciadorNome === undefined
          ? atual.influenciadorNome
          : patch.influenciadorNome,
      influenciadorContato:
        patch.influenciadorContato === undefined
          ? atual.influenciadorContato
          : patch.influenciadorContato,
      comissaoPercentual: patch.comissaoPercentual ?? atual.comissaoPercentual,
    }

    try {
      const cupom = await db.cupom.update({
        where: { id },
        data: prepararDados(completo),
      })
      return authJson({ success: true, cupom })
    } catch (error) {
      erroPrisma(error)
    }
  } catch (error) {
    return authFailure(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req)
    await requireAdmin()
    const id = req.nextUrl.searchParams.get('id')
    if (!id || id.length > 100) throw new AuthError('Cupom inválido.', 400)

    const cupom = await db.cupom.findUnique({
      where: { id },
      include: { _count: { select: { usos: true } } },
    })
    if (!cupom) throw new AuthError('Cupom não encontrado.', 404)

    if (cupom._count.usos > 0) {
      await db.cupom.update({ where: { id }, data: { ativo: false } })
      return authJson({ success: true, archived: true })
    }

    await db.cupom.delete({ where: { id } })
    return authJson({ success: true, archived: false })
  } catch (error) {
    return authFailure(error)
  }
}
