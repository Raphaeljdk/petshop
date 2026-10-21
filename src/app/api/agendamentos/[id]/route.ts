import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import { agendamentoPatchSchema } from '@/lib/agenda-validation'
import { inferirCategoriaAgenda } from '@/lib/agenda-servicos'
type Params = { params: Promise<{ id: string }> }
async function admin() {
  const user = await getUsuarioLogado()
  if (!user) return { denied: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }), user: null }
  if (user.role !== 'ADMIN') return { denied: NextResponse.json({ error: 'Acesso negado.' }, { status: 403 }), user: null }
  return { denied: null, user }
}
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await admin()
  if (auth.denied) return auth.denied
  try {
    assertSameOrigin(req)
    const { id } = await params
    const changes = agendamentoPatchSchema.parse(await req.json())
    if (Object.keys(changes).length === 0) return NextResponse.json({ error: 'Nenhuma alteração informada.' }, { status: 400 })
    const existing = await db.agendamento.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 })
    if (existing.status === 'cancelado' && changes.status !== 'agendado') {
      return NextResponse.json({ error: 'O agendamento está cancelado. Para reabrir, altere o status para agendado.' }, { status: 409 })
    }
    const petId = changes.petId || existing.petId
    const clienteId = changes.clienteId || existing.clienteId
    const pet = await db.pet.findFirst({ where: { id: petId, clienteId, ativo: true, cliente: { ativo: true } }, select: { id: true } })
    if (!pet) return NextResponse.json({ error: 'Pet não corresponde ao tutor selecionado.' }, { status: 409 })
    const dataHora = changes.dataHora ? new Date(changes.dataHora) : existing.dataHora
    if (Number.isNaN(dataHora.getTime())) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 })
    const status = changes.status || existing.status
    if (['agendado', 'confirmado'].includes(status)) {
      const conflito = await db.agendamento.findFirst({
        where: { id: { not: id }, petId, dataHora, status: { in: ['agendado', 'confirmado'] } }, select: { id: true },
      })
      if (conflito) return NextResponse.json({ error: 'Já existe atendimento reservado para esse pet nesse horário.' }, { status: 409 })
    }
    const item = await db.$transaction(async tx => {
      const updated = await tx.agendamento.update({
        where: { id },
        data: {
          clienteId, petId, servico: changes.servico || existing.servico,
          categoria: changes.categoria || (changes.servico ? inferirCategoriaAgenda(changes.servico) : existing.categoria),
          dataHora, status,
          observacoes: changes.observacoes !== undefined ? changes.observacoes || null : existing.observacoes,
        },
        include: { pet: true, cliente: true },
      })
      const action = status === 'cancelado' && existing.status !== 'cancelado' ? 'cancelado'
        : changes.dataHora && dataHora.getTime() !== existing.dataHora.getTime() ? 'remarcado' : 'alterado'
      await tx.agendaEvento.create({
        data: { agendamentoId: id, acao: action, autorId: auth.user!.id, detalhe: 'Status anterior: ' + existing.status },
      })
      return updated
    })
    return NextResponse.json(item)
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    console.error('agenda PATCH:', error)
    return NextResponse.json({ error: 'Erro ao atualizar agendamento.' }, { status: 500 })
  }
}
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await admin()
  if (auth.denied) return auth.denied
  try {
    assertSameOrigin(req)
    const { id } = await params
    const existing = await db.agendamento.findUnique({ where: { id }, select: { status: true } })
    if (!existing) return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 })
    if (existing.status === 'cancelado') return NextResponse.json({ success: true, status: 'cancelado' })
    await db.$transaction(async tx => {
      await tx.agendamento.update({ where: { id }, data: { status: 'cancelado' } })
      await tx.agendaEvento.create({ data: { agendamentoId: id, acao: 'cancelado', autorId: auth.user!.id } })
    })
    return NextResponse.json({ success: true, status: 'cancelado' })
  } catch (error) {
    console.error('agenda DELETE:', error)
    return NextResponse.json({ error: 'Erro ao cancelar o agendamento.' }, { status: 500 })
  }
}
