import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { AuthError, readAuthBody } from '@/lib/auth-http'
import { getZettaAnimalsByClient } from '@/lib/zetta-client'
import { listOfficialAgenda } from '@/lib/siggma/agendamentos'
import { getSiggmaBookingConfig } from '@/lib/siggma/booking'
import { SiggmaApiError } from '@/lib/siggma/client'
import { siggma } from '@/lib/siggma/service'

function oneYearAgo() {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 1)
  return date.toISOString().slice(0, 10)
}

function normalizePetId(value: string | number) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null
  }
  const match = value.trim().match(/^(?:zetta:)?(\d+)$/)
  if (!match) return null
  const id = Number(match[1])
  return Number.isInteger(id) && id > 0 ? id : null
}

function normalizeQuando(value: string) {
  const match = value
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/)
  if (!match) return null

  const [, date, time, seconds = '00'] = match
  const instant = new Date(`${date}T${time}:${seconds}-03:00`)
  if (Number.isNaN(instant.getTime())) return null

  return { apiValue: `${date} ${time}:${seconds}`, instant }
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof SiggmaApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      )
    }
    return NextResponse.json({ error: 'Erro ao consultar agenda' }, { status: 500 })
  }
}

const createSchema = z
  .object({
    petId: z.union([z.string().min(1).max(80), z.number().int().positive()]),
    servicoId: z.coerce.number().int().positive(),
    quando: z.string().min(16).max(25),
    observacoes: z.string().trim().max(1000).optional().nullable(),
  })
  .strict()

export async function POST(req: NextRequest) {
  try {
    const usuario = await getUsuarioLogado()
    const cliente = usuario?.cliente
    if (!usuario || !cliente) {
      return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })
    }
    if (!usuario.siggmaCliCod) {
      return NextResponse.json(
        {
          error:
            'Esta conta ainda não está vinculada ao cliente oficial do Siggma. Use a solicitação à equipe.',
        },
        { status: 409 }
      )
    }

    const parsed = createSchema.safeParse(await readAuthBody(req))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Confira pet, serviço, data e horário do agendamento.' },
        { status: 400 }
      )
    }

    const config = getSiggmaBookingConfig()
    if (!config.expedienteId) {
      return NextResponse.json(
        {
          error:
            'A agenda direta está aguardando o ID do expediente oficial. A solicitação à equipe continua disponível.',
          code: 'SIGGMA_BOOKING_SETUP_REQUIRED',
        },
        { status: 503 }
      )
    }

    const petId = normalizePetId(parsed.data.petId)
    if (!petId) {
      return NextResponse.json({ error: 'Pet inválido.' }, { status: 400 })
    }

    const quando = normalizeQuando(parsed.data.quando)
    if (!quando || quando.instant.getTime() <= Date.now() + 60_000) {
      return NextResponse.json(
        { error: 'Escolha uma data e horário futuros válidos.' },
        { status: 400 }
      )
    }

    const pets = await getZettaAnimalsByClient(usuario.siggmaCliCod)
    if (!pets.some((pet) => Number(pet.id) === petId)) {
      return NextResponse.json(
        { error: 'Este pet não pertence à conta autenticada.' },
        { status: 403 }
      )
    }

    if (
      config.services.length &&
      !config.services.some((service) => service.id === parsed.data.servicoId)
    ) {
      return NextResponse.json(
        { error: 'Serviço não habilitado para agendamento pelo portal.' },
        { status: 400 }
      )
    }

    const result = await siggma.agendamentos.agendar(config.expedienteId, {
      quando: quando.apiValue,
      servicoId: parsed.data.servicoId,
      clienteId: usuario.siggmaCliCod,
      petId,
      ...(parsed.data.observacoes
        ? { observacoes: parsed.data.observacoes }
        : {}),
    })

    return NextResponse.json({ ok: true, origem: 'siggma', result }, { status: 201 })
  } catch (error) {
    console.error('cliente/agendamentos POST erro:', error)
    if (error instanceof SiggmaApiError) {
      return NextResponse.json(
        {
          error:
            error.status === 422
              ? 'O Siggma não aceitou esse horário ou os dados do agendamento.'
              : error.message,
          details: error.details,
        },
        { status: error.status }
      )
    }
    return NextResponse.json(
      { error: 'Não foi possível criar o agendamento no Siggma.' },
      { status: 500 }
    )
  }
}
