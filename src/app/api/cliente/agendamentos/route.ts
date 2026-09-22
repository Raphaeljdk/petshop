import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { formatSiggmaQuando, normalizeSiggmaAgendaItem, parseZettaPetId } from '@/lib/siggma/agendamentos'
import { SiggmaApiError } from '@/lib/siggma/client'
import { getSiggmaSchedulingConfig, SiggmaConfigurationError } from '@/lib/siggma/config'
import { siggma } from '@/lib/siggma/service'

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    const cliente = usuario?.cliente
    if (!usuario || !cliente) return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })

    if (usuario.siggmaCliCod) {
      const response = await siggma.agendamentos.consultar({ cliente: usuario.siggmaCliCod, pagina: 1 })
      return NextResponse.json((response.data || []).map((item) => normalizeSiggmaAgendaItem(item, cliente.id)))
    }

    const agendamentos = await db.agendamento.findMany({
      where: { clienteId: cliente.id },
      orderBy: { dataHora: 'asc' },
      include: { pet: true },
    })
    return NextResponse.json(agendamentos)
  } catch (error) {
    console.error('cliente/agendamentos GET erro:', error)
    if (error instanceof SiggmaApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status })
    return NextResponse.json({ error: 'Erro ao listar agendamentos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await getUsuarioLogado()
    const cliente = usuario?.cliente
    if (!usuario || !cliente) return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })

    const body = await req.json()

    if (usuario.siggmaCliCod) {
      const petId = parseZettaPetId(body.petId)
      const servicoId = Number.parseInt(String(body.servicoId || ''), 10)
      const quando = formatSiggmaQuando(body.quando || body.dataHora)
      if (!petId || !Number.isFinite(servicoId) || servicoId < 1 || !quando) {
        return NextResponse.json({ error: 'petId, servicoId e horário válido são obrigatórios.' }, { status: 400 })
      }

      const { expedienteId } = getSiggmaSchedulingConfig()
      const animal = await siggma.animais.buscar(petId)
      if (!animal || animal.cliente?.cliCod !== usuario.siggmaCliCod) {
        return NextResponse.json({ error: 'Pet não pertence ao cliente autenticado.' }, { status: 403 })
      }

      const result = await siggma.agendamentos.criar(expedienteId, {
        clienteId: usuario.siggmaCliCod,
        petId,
        servicoId,
        quando,
        observacoes: typeof body.observacoes === 'string' && body.observacoes.trim() ? body.observacoes.trim() : undefined,
      })
      return NextResponse.json(result, { status: 201 })
    }

    const { petId, servico, dataHora, observacoes } = body
    if (!petId || !servico || !dataHora) {
      return NextResponse.json({ error: 'petId, servico e dataHora são obrigatórios' }, { status: 400 })
    }

    const pet = await db.pet.findUnique({ where: { id: petId } })
    if (!pet) return NextResponse.json({ error: 'Pet não encontrado' }, { status: 404 })
    if (pet.clienteId !== cliente.id) return NextResponse.json({ error: 'Pet não pertence ao cliente' }, { status: 403 })

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
  } catch (error) {
    console.error('cliente/agendamentos POST erro:', error)
    if (error instanceof SiggmaConfigurationError) return NextResponse.json({ error: 'Agendamento Siggma ainda não está configurado.', missing: error.missing }, { status: 503 })
    if (error instanceof SiggmaApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status })
    return NextResponse.json({ error: 'Erro ao criar agendamento' }, { status: 500 })
  }
}
