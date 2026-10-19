import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { assertSameOrigin } from '@/lib/auth-http'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req)
    const user = await getUsuarioLogado()
    if (!user?.cliente) return NextResponse.json({ error: 'Cliente não autenticado.' }, { status: 401 })
    const { id } = await params
    const item = await db.agendamento.findFirst({
      where: { id, clienteId: user.cliente.id }, select: { id: true, status: true, dataHora: true },
    })
    if (!item) return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 })
    if (item.status !== 'agendado') return NextResponse.json({ error: 'Somente agendamentos ainda não iniciados podem ser cancelados pelo portal.' }, { status: 409 })
    if (item.dataHora.getTime() <= Date.now() + 24 * 60 * 60_000)
      return NextResponse.json({ error: 'Faltam menos de 24 horas. Fale com a equipe para cancelar.' }, { status: 409 })
    await db.$transaction(async tx => {
      const changed = await tx.agendamento.updateMany({ where: { id, clienteId: user.cliente!.id, status: 'agendado' }, data: { status: 'cancelado' } })
      if (changed.count !== 1) throw new Error('Agendamento alterado durante cancelamento.')
      await tx.agendaEvento.create({ data: { agendamentoId: id, acao: 'cancelado_cliente', autorId: user.id } })
    })
    return NextResponse.json({ success: true, status: 'cancelado' })
  } catch (e) {
    console.error('portal agenda DELETE:', e)
    return NextResponse.json({ error: 'Não foi possível cancelar a reserva.' }, { status: 500 })
  }
}
