import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import { agendamentoSchema, statusAgenda } from '@/lib/agenda-validation'
import { inferirCategoriaAgenda } from '@/lib/agenda-servicos'
import { canViewAppointments, canScheduleBath, isOperationalOperator } from '@/lib/operational-access'
import { getOperationalProfessional } from '@/lib/agenda-bloqueios'
import { conflitoAgenda } from '@/lib/catalogo-agenda-publica'
import { horarioBloqueado } from '@/lib/agenda-bloqueios-policy'

export const dynamic = 'force-dynamic'
async function admin() {
  const user = await getUsuarioLogado()
  if (!user) return { denied: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }), user: null }
  if (!canViewAppointments(user)) return { denied: NextResponse.json({ error: 'Acesso negado.' }, { status: 403 }), user: null }
  return { denied: null, user }
}
export async function GET(req: NextRequest) {
  const auth = await admin()
  if (auth.denied) return auth.denied
  try {
    const status = req.nextUrl.searchParams.get('status')
    const inicio = req.nextUrl.searchParams.get('inicio')
    const fim = req.nextUrl.searchParams.get('fim')
    // Agenda de mês/semana/dia usa o intervalo completo, não uma página arbitrária de 100 eventos.
    if (inicio || fim) {
      if (!inicio || !fim) return NextResponse.json({ error: 'Informe início e fim da agenda.' }, { status: 400 })
      const de = new Date(inicio), ate = new Date(fim)
      if (!Number.isFinite(de.getTime()) || !Number.isFinite(ate.getTime()) ||
          ate <= de || ate.getTime() - de.getTime() > 47 * 86400_000)
        return NextResponse.json({ error: 'Intervalo inválido; limite de 47 dias.' }, { status: 400 })
      const where = { dataHora: { gte: de, lte: ate }, ...(status && statusAgenda.safeParse(status).success ? { status } : {}) }
      const [items, total] = await Promise.all([
        db.agendamento.findMany({
          where, orderBy: [{dataHora:'asc'}, {id:'asc'}], take: 500,
          include: { cliente: { select: { id: true, nome: true, telefone: true } },
            pet: { select: { id: true, nome: true, especie: true } }, profissional: { select: { id: true, nome: true, especialidades: true, ativo: true } } },
        }),
        db.agendamento.count({ where }),
      ])
      return NextResponse.json({ items, total, truncado: total > items.length }, { headers: { 'Cache-Control': 'private, no-store' } })
    }
    const page = Math.min(10000, Math.max(1, Number(req.nextUrl.searchParams.get('pagina')) || 1))
    const limit = 100
    const where = status && statusAgenda.safeParse(status).success ? { status } : {}
    const [items, total] = await Promise.all([
      db.agendamento.findMany({
        where, orderBy: { dataHora: 'desc' }, skip: (page - 1) * limit,
        take: limit, include: { cliente: { select: { id: true, nome: true, telefone: true } }, pet: { select: { id: true, nome: true, especie: true } }, profissional: { select: { id: true, nome: true, especialidades: true, ativo: true } } },
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
  if (!canScheduleBath(auth.user)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  try {
    assertSameOrigin(req)
    const data = agendamentoSchema.parse(await req.json())
    if (isOperationalOperator(auth.user) && (data.servico.toLowerCase() !== 'banho' ||
      (data.categoria && data.categoria !== 'Estéticos') || data.profissionalId)) {
      return NextResponse.json({ error: 'Esta conta pode agendar somente banho, sem alterar a equipe.' }, { status: 403 })
    }
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
    if (data.profissionalId) {
      const profissional = await db.profissionalAgenda.findFirst({ where: { id: data.profissionalId, ativo: true }, select: { id: true } })
      if (!profissional) return NextResponse.json({ error: 'Profissional indisponível para novos agendamentos.' }, { status: 409 })
    }
    const propria = isOperationalOperator(auth.user) ? await getOperationalProfessional(auth.user!) : null
    if (isOperationalOperator(auth.user) && (!propria || !propria.ativo)) return NextResponse.json({ error: 'Seu cadastro de profissional está indisponível.' }, { status: 409 })
    const profissionalId = propria?.id || data.profissionalId || null
    const item = await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('matilha-agenda-reservas'))`
      const capacidade=await conflitoAgenda(tx,{inicio:dataHora,profissionalId,petId:data.petId,servico:data.servico})
      if(capacidade.conflito)throw new Error('AGENDA_BLOQUEADA')
      if (profissionalId) {
        const bloqueio = await tx.agendaBloqueio.findFirst({
          where: { profissionalId, inicio: { lte: dataHora }, fim: { gt: dataHora } },
          select: { id: true, inicio: true, fim: true },
        })
        if (bloqueio && horarioBloqueado(dataHora, bloqueio.inicio, bloqueio.fim)) throw new Error('AGENDA_BLOQUEADA')
      }
      const created = await tx.agendamento.create({
        data: { clienteId: data.clienteId, petId: data.petId, dataHora, servico: data.servico,
          categoria: data.categoria || inferirCategoriaAgenda(data.servico),
          observacoes: data.observacoes || null, profissionalId,duracaoMinutos:capacidade.duracao },
        include: { pet: true, cliente: true },
      })
      await tx.agendaEvento.create({ data: { agendamentoId: created.id, acao: 'criado', autorId: auth.user!.id } })
      return created
    }, { isolationLevel: 'Serializable' })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Dados inválidos.' }, { status: 400 })
    if (error instanceof Error && error.message === 'AGENDA_BLOQUEADA') return NextResponse.json({ error: 'O profissional bloqueou este horário. Selecione outro.' }, { status: 409 })
    if ((error as {code?:string})?.code === 'P2034') return NextResponse.json({ error: 'A agenda mudou. Atualize e tente novamente.' }, { status: 409 })
    console.error('agenda POST:', error)
    return NextResponse.json({ error: 'Erro ao criar agendamento.' }, { status: 500 })
  }
}
