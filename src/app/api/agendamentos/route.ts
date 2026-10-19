import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import { agendamentoSchema, statusAgenda } from '@/lib/agenda-validation'

export const dynamic = 'force-dynamic'
async function admin() {
  const user = await getUsuarioLogado()
  if (!user) return { denied: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }), user: null }
  if (user.role !== 'ADMIN') return { denied: NextResponse.json({ error: 'Acesso negado.' }, { status: 403 }), user: null }
  return { denied: null, user }
}
export async function GET(req: NextRequest) {
  const auth = await admin()
  if (auth.denied) return auth.denied
  try {
    const status = req.nextUrl.searchParams.get('status')
    const page = Math.min(10000, Math.max(1, Number(req.nextUrl.searchParams.get('pagina')) || 1))
    const limit = 100
    const where = status && statusAgenda.safeParse(status).success ? { status } : {}
    const [items, total] = await Promise.all([
      db.agendamento.findMany({
        where, orderBy: { dataHora: 'desc' }, skip: (page - 1) * limit,
        take: limit, include: { cliente: { select: { id: true, nome: true, telefone: true } }, pet: { select: { id: true, nome: true, especie: true } } },
      }),
      db.agendamento.count({ where }),
    ])
    return NextResponse.json({ items, total, pagina: page, porPagina: limit }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('agenda GET:', error)
    return NextResponse.json({ error: 'Erro ao carregar agenda própria.' }, { status: 500 })
  }
}
export async function POST(req: NextRequest) {
  const auth = await admin()
  if (auth.denied) return auth.denied
  try {
    assertSameOrigin(req)
    const data = agendamentoSchema.parse(await req.json())
    const dataHora = new Date(data.dataHora)
    if (Number.isNaN(dataHora.getTime())) return NextResponse.json({ error: 'Data/hora inválida.' }, { status: 400 })
    const pet = await db.pet.findFirst({
      where: { id: data.petId, clienteId: data.clienteId, ativo: true, cliente: { ativo: true } },
      select: { id: true },
    })
    if (!pet) return NextResponse.json({ error: 'Selecione um pet ativo vinculado ao tutor.' }, { status: 409 })
    const conflito = await db.agendamento.findFirst({
      where: { petId: data.petId, dataHora, status: { in: ['agendado', 'confirmado'] } },
      select: { id: true },
    })
    if (conflito) return NextResponse.json({ error: 'Este pet já possui agendamento nesse horário.' }, { status: 409 })
    const item = await db.$transaction(async tx => {
      const created = await tx.agendamento.create({
        data: { clienteId: data.clienteId, petId: data.petId, dataHora, servico: data.servico, observacoes: data.observacoes || null },
        include: { pet: true, cliente: true },
      })
      await tx.agendaEvento.create({ data: { agendamentoId: created.id, acao: 'criado', autorId: auth.user!.id } })
      return created
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Dados inválidos.' }, { status: 400 })
    console.error('agenda POST:', error)
    return NextResponse.json({ error: 'Erro ao criar agendamento.' }, { status: 500 })
  }
}
