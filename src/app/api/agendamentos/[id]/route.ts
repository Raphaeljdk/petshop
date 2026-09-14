import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { status, dataHora, observacoes, servico } = body

    const agendamentoExistente = await db.agendamento.findUnique({ where: { id } })
    if (!agendamentoExistente) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    }

    const dados: any = {}
    if (status !== undefined) dados.status = status
    if (dataHora !== undefined) dados.dataHora = new Date(dataHora)
    if (observacoes !== undefined) dados.observacoes = observacoes
    if (servico !== undefined) dados.servico = servico

    const agendamento = await db.agendamento.update({
      where: { id },
      data: dados,
      include: { pet: true, cliente: true },
    })

    return NextResponse.json(agendamento)
  } catch (e) {
    console.error('agendamento PATCH erro:', e)
    return NextResponse.json({ error: 'Erro ao atualizar agendamento' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params
    const agendamentoExistente = await db.agendamento.findUnique({ where: { id } })
    if (!agendamentoExistente) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    }

    await db.agendamento.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('agendamento DELETE erro:', e)
    return NextResponse.json({ error: 'Erro ao deletar agendamento' }, { status: 500 })
  }
}
