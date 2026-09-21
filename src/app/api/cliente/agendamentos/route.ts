import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado, getUsuarioLogado } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    const cliente = usuario?.cliente
    if (!usuario || !cliente) {
      return NextResponse.json(
        { error: 'Cliente não autenticado' },
        { status: 401 }
      )
    }

    const agendamentos = await db.agendamento.findMany({
      where: { clienteId: cliente.id },
      orderBy: { dataHora: 'asc' },
      include: { pet: true },
    })

    return NextResponse.json(agendamentos)
  } catch (e) {
    console.error('cliente/agendamentos GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar agendamentos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await getUsuarioLogado()
    const cliente = usuario?.cliente
    if (!usuario || !cliente) {
      return NextResponse.json(
        { error: 'Cliente não autenticado' },
        { status: 401 }
      )
    }

    if (usuario.siggmaCliCod) {
      return NextResponse.json(
        {
          error:
            'Agendamento para pets vinculados ao Siggma será habilitado após o endpoint oficial de gravação do ERP ser confirmado.',
        },
        { status: 409 }
      )
    }

    const body = await req.json()
    const { petId, servico, dataHora, observacoes } = body

    if (!petId || !servico || !dataHora) {
      return NextResponse.json(
        { error: 'petId, servico e dataHora são obrigatórios' },
        { status: 400 }
      )
    }

    // valida que pet pertence ao cliente
    const pet = await db.pet.findUnique({ where: { id: petId } })
    if (!pet) {
      return NextResponse.json({ error: 'Pet não encontrado' }, { status: 404 })
    }
    if (pet.clienteId !== cliente.id) {
      return NextResponse.json(
        { error: 'Pet não pertence ao cliente' },
        { status: 403 }
      )
    }

    const agendamento = await db.agendamento.create({
      data: {
        petId,
        clienteId: cliente.id,
        servico,
        dataHora: new Date(dataHora),
        observacoes: observacoes || null,
        status: 'agendado',
      },
      include: { pet: true, cliente: true },
    })

    return NextResponse.json(agendamento, { status: 201 })
  } catch (e) {
    console.error('cliente/agendamentos POST erro:', e)
    return NextResponse.json({ error: 'Erro ao criar agendamento' }, { status: 500 })
  }
}
