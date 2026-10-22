import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'

export const dynamic = 'force-dynamic'

const fields = z.object({
  nome: z.string().trim().min(2, 'Informe um nome com pelo menos 2 caracteres.').max(80),
  especialidades: z.string().trim().max(200).nullish(),
}).strict()
const changes = fields.partial().extend({
  id: z.string().min(1),
  ativo: z.boolean().optional(),
}).strict()

async function authorize() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  return null
}

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || 'Dados inválidos.' }, { status: 400 })
  }
  console.error('profissionais da agenda:', error)
  return NextResponse.json({ error: 'Erro ao consultar profissionais.' }, { status: 500 })
}

export async function GET() {
  const denied = await authorize()
  if (denied) return denied
  try {
    const items = await db.profissionalAgenda.findMany({
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
      select: { id: true, nome: true, especialidades: true, ativo: true },
    })
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return errorResponse(error) }
}

export async function POST(req: NextRequest) {
  const denied = await authorize()
  if (denied) return denied
  try {
    assertSameOrigin(req)
    const data = fields.parse(await req.json())
    const duplicate = await db.profissionalAgenda.findFirst({
      where: { nome: { equals: data.nome, mode: 'insensitive' } }, select: { id: true },
    })
    if (duplicate) return NextResponse.json({ error: 'Já existe profissional com esse nome.' }, { status: 409 })
    const item = await db.profissionalAgenda.create({ data: {
      nome: data.nome, especialidades: data.especialidades || null,
    }, select: { id: true, nome: true, especialidades: true, ativo: true } })
    return NextResponse.json(item, { status: 201 })
  } catch (error) { return errorResponse(error) }
}

export async function PATCH(req: NextRequest) {
  const denied = await authorize()
  if (denied) return denied
  try {
    assertSameOrigin(req)
    const data = changes.parse(await req.json())
    if (data.nome === undefined && data.especialidades === undefined && data.ativo === undefined) {
      return NextResponse.json({ error: 'Nenhuma alteração informada.' }, { status: 400 })
    }
    const existing = await db.profissionalAgenda.findUnique({ where: { id: data.id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Profissional não encontrado.' }, { status: 404 })
    if (data.nome !== undefined) {
      const duplicate = await db.profissionalAgenda.findFirst({
        where: { id: { not: data.id }, nome: { equals: data.nome, mode: 'insensitive' } },
        select: { id: true },
      })
      if (duplicate) return NextResponse.json({ error: 'Já existe profissional com esse nome.' }, { status: 409 })
    }
    const item = await db.profissionalAgenda.update({
      where: { id: data.id },
      data: {
        ...(data.nome !== undefined ? { nome: data.nome } : {}),
        ...(data.especialidades !== undefined ? { especialidades: data.especialidades || null } : {}),
        ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
      },
      select: { id: true, nome: true, especialidades: true, ativo: true },
    })
    return NextResponse.json(item)
  } catch (error) { return errorResponse(error) }
}
