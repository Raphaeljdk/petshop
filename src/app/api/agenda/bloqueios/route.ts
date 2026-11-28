import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { assertSameOrigin } from '@/lib/auth-http'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { getOperationalProfessional } from '@/lib/agenda-bloqueios'
import { conflitoAgenda } from '@/lib/catalogo-agenda-publica'
import { isOperationalOperator } from '@/lib/operational-access'

export const dynamic = 'force-dynamic'
const payloadSchema = z.object({
  inicio: z.string().datetime({ offset: true }),
  fim: z.string().datetime({ offset: true }),
  motivo: z.string().trim().min(2).max(120),
}).strict()

async function authorize() {
  const user = await getUsuarioLogado()
  if (!user) return { user: null, denied: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) }
  if (user.role !== 'ADMIN' && !isOperationalOperator(user)) {
    return { user: null, denied: NextResponse.json({ error: 'Acesso negado.' }, { status: 403 }) }
  }
  return { user, denied: null }
}
function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Dados inválidos.' }, { status: 400 })
  if (error instanceof Error && error.message === 'BLOQUEIO_EM_CONFLITO') return NextResponse.json({ error: 'Já existe um bloqueio nesse intervalo.' }, { status: 409 })
  if (error instanceof Error && error.message === 'AGENDAMENTO_EM_CONFLITO') return NextResponse.json({ error: 'Há um atendimento marcado neste período. Remarque-o antes de bloquear.' }, { status: 409 })
  if ((error as {code?: string})?.code === 'P2034') return NextResponse.json({ error: 'A agenda foi atualizada. Tente novamente.' }, { status: 409 })
  console.error('[agenda/bloqueios]', error)
  return NextResponse.json({ error: 'Não foi possível atualizar os bloqueios.' }, { status: 500 })
}

export async function GET() {
  const { user, denied } = await authorize()
  if (denied || !user) return denied
  try {
    const profissional = isOperationalOperator(user) ? await getOperationalProfessional(user) : null
    const desde = new Date(Date.now() - 7 * 86400_000)
    const rows = await db.agendaBloqueio.findMany({
      where: { fim: { gte: desde } },
      include: { profissional: { select: { nome: true, userId: true } } },
      orderBy: [{ inicio: 'asc' }, { id: 'asc' }],
      take: 250,
    })
    const items = rows.map(item => {
      const proprio = item.profissionalId === profissional?.id
      return {
        id: item.id, inicio: item.inicio, fim: item.fim, profissional: item.profissional.nome,
        motivo: user.role === 'ADMIN' || proprio ? item.motivo : 'Indisponível',
        podeExcluir: user.role === 'ADMIN' || proprio,
      }
    })
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return errorResponse(error) }
}

export async function POST(req: NextRequest) {
  const { user, denied } = await authorize()
  if (denied || !user) return denied
  if (!isOperationalOperator(user)) return NextResponse.json({ error: 'Somente o profissional pode bloquear a própria agenda.' }, { status: 403 })
  try {
    assertSameOrigin(req)
    const data = payloadSchema.parse(await req.json())
    const inicio = new Date(data.inicio), fim = new Date(data.fim)
    if (inicio.getTime() < Date.now() - 60_000 || inicio.getTime() > Date.now() + 365 * 86400_000 ||
        fim <= inicio || fim.getTime() - inicio.getTime() > 31 * 86400_000) {
      return NextResponse.json({ error: 'Escolha um intervalo futuro de até 31 dias.' }, { status: 400 })
    }
    const profissional = await getOperationalProfessional(user)
    if (!profissional?.ativo) return NextResponse.json({ error: 'Seu cadastro de profissional está indisponível.' }, { status: 409 })
    const item = await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('matilha-agenda-reservas'))`
      const block = await tx.agendaBloqueio.findFirst({
        where: { profissionalId: profissional.id, inicio: { lt: fim }, fim: { gt: inicio } }, select: { id: true },
      })
      if (block) throw new Error('BLOQUEIO_EM_CONFLITO')
      const appointment=await conflitoAgenda(tx,{inicio,fim,profissionalId:profissional.id})
      if (appointment.conflito) throw new Error('AGENDAMENTO_EM_CONFLITO')
      return tx.agendaBloqueio.create({ data: { profissionalId: profissional.id, inicio, fim, motivo: data.motivo, criadoPorId: user.id } })
    }, { isolationLevel: 'Serializable' })
    return NextResponse.json({ id: item.id }, { status: 201 })
  } catch (error) { return errorResponse(error) }
}

export async function DELETE(req: NextRequest) {
  const { user, denied } = await authorize()
  if (denied || !user) return denied
  try {
    assertSameOrigin(req)
    const id = req.nextUrl.searchParams.get('id')
    if (!id || id.length > 100) return NextResponse.json({ error: 'Bloqueio inválido.' }, { status: 400 })
    const item = await db.agendaBloqueio.findUnique({
      where: { id }, include: { profissional: { select: { userId: true } } },
    })
    if (!item) return NextResponse.json({ error: 'Bloqueio não encontrado.' }, { status: 404 })
    if (user.role !== 'ADMIN' && item.profissional.userId !== user.id) return NextResponse.json({ error: 'Você só pode remover bloqueios da sua agenda.' }, { status: 403 })
    await db.agendaBloqueio.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) { return errorResponse(error) }
}
