import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const agendamentos = await db.agendamento.findMany({
      orderBy: { dataHora: 'asc' },
      include: { pet: true, cliente: true },
    })

    return NextResponse.json(agendamentos)
  } catch (e) {
    console.error('agendamentos GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar agendamentos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await req.json()
    const { petId, clienteId, servico, dataHora, status, observacoes } = body

    if (!petId || !clienteId || !servico || !dataHora) {
      return NextResponse.json(
        { error: 'petId, clienteId, servico e dataHora são obrigatórios' },
        { status: 400 }
      )
    }

    const agendamento = await db.agendamento.create({
      data: {
        petId,
        clienteId,
        servico,
        dataHora: new Date(dataHora),
        status: status || 'agendado',
        observacoes: observacoes || null,
      },
      include: { pet: true, cliente: true },
    })

    return NextResponse.json(agendamento, { status: 201 })
  } catch (e) {
    console.error('agendamentos POST erro:', e)
    return NextResponse.json({ error: 'Erro ao criar agendamento' }, { status: 500 })
  }
}
