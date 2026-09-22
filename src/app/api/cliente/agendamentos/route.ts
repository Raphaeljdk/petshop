import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { listOfficialAgenda } from '@/lib/siggma/agendamentos'
import { SiggmaApiError } from '@/lib/siggma/client'

function oneYearAgo() {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 1)
  return date.toISOString().slice(0, 10)
}

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    const cliente = usuario?.cliente
    if (!usuario || !cliente) {
      return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })
    }

    if (usuario.siggmaCliCod) {
      const agenda = await listOfficialAgenda({
        cliente: usuario.siggmaCliCod,
        dataInicial: oneYearAgo(),
      })
      return NextResponse.json(agenda, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const agendamentos = await db.agendamento.findMany({
      where: { clienteId: cliente.id },
      orderBy: { dataHora: 'asc' },
      include: { pet: true },
    })
    return NextResponse.json(agendamentos)
  } catch (error) {
    console.error('cliente/agendamentos GET erro:', error)
    if (error instanceof SiggmaApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      )
    }
    return NextResponse.json({ error: 'Erro ao consultar agenda' }, { status: 500 })
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'A criação de agendamentos ainda não está disponível na API oficial do Siggma. Fale com a Matilha Prado para marcar seu horário.',
    },
    { status: 405, headers: { Allow: 'GET' } }
  )
}
