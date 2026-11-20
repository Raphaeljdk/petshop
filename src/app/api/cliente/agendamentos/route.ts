import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { assertSameOrigin } from '@/lib/auth-http'
import { listarServicosParaConfiguracao } from '@/lib/catalogo-servicos-matilha'
import { dataReservavel, gerarSlots, slotEstaLivre, timestampBrasilia } from '@/lib/agenda-online'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const usuario = await getUsuarioLogado()
  if (!usuario?.cliente) return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })
  try {
    const agendamentos = await db.agendamento.findMany({
      where: { clienteId: usuario.cliente.id },
      orderBy: { dataHora: 'asc' },
      include: { pet: true },
    })
    return NextResponse.json(agendamentos, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('cliente/agendamentos GET:', error)
    return NextResponse.json({ error: 'Não foi possível consultar agendamentos.' }, { status: 500 })
  }
}

const reservaSchema = z.object({
  petId: z.string().min(1).max(100),
  servicoChave: z.string().min(2).max(100),
  profissionalId: z.string().min(1).max(100),
  dataHora: z.string().datetime({ offset: true }),
  observacoes: z.string().trim().max(1000).optional(),
}).strict()

class ReservaIndisponivel extends Error {
  constructor(message: string, public status = 409) { super(message) }
}

export async function POST(request: NextRequest) {
  const usuario = await getUsuarioLogado()
  if (!usuario?.cliente || usuario.role !== 'CLIENTE')
    return NextResponse.json({ error: 'Cliente não autenticado.' }, { status: 401 })
  try {
    assertSameOrigin(request)
    const entrada = reservaSchema.parse(await request.json())
    const inicio = new Date(entrada.dataHora)
    const data = new Date(inicio.getTime() - 3 * 3600_000).toISOString().slice(0, 10)
    const clienteId = usuario.cliente.id

    const reserva = await db.$transaction(async (tx) => {
      // Impede que duas reservas online disputem o último horário de um profissional.
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',
        'agenda-online:' + entrada.profissionalId + ':' + data)
      const [config, registros, profissional, pet] = await Promise.all([
        tx.agendaOnlineConfig.findUnique({ where: { id: 'padrao' } }),
        tx.servicoEsteticoConfig.findMany(),
        tx.profissionalAgenda.findFirst({ where: { id: entrada.profissionalId, ativo: true }, select: { id: true } }),
        tx.pet.findFirst({
          where: { id: entrada.petId, clienteId, ativo: true, cliente: { ativo: true } },
          select: { id: true },
        }),
      ])
      if (!pet) throw new ReservaIndisponivel('Pet não encontrado na sua conta.', 404)
      if (!profissional) throw new ReservaIndisponivel('Profissional indisponível. Escolha outro.', 409)
      if (!config?.enabled || !dataReservavel(data, config))
        throw new ReservaIndisponivel('A agenda online não está disponível nesta data.', 409)

      const catalogo = listarServicosParaConfiguracao(registros)
      const servico = catalogo.find((item) => item.chave === entrada.servicoChave)
      if (!servico?.confirmado || servico.duracaoMinutos === null)
        throw new ReservaIndisponivel('Serviço indisponível para agendamento online.', 409)

      const slots = gerarSlots(data, servico.duracaoMinutos, config)
      if (!slots.some((slot) => slot.getTime() === inicio.getTime()))
        throw new ReservaIndisponivel('Horário inválido ou fora do expediente. Atualize os horários.', 409)

      const dia = timestampBrasilia(data, 0)
      const diaFim = new Date(dia.getTime() + 86400_000)
      const [agendados, bloqueios] = await Promise.all([
        tx.agendamento.findMany({
          where: { dataHora: { gte: new Date(dia.getTime() - 720 * 60000), lt: diaFim },
            status: { in: ['agendado', 'confirmado'] } },
          select: { dataHora: true, servico: true, profissionalId: true, petId: true, status: true },
        }),
        tx.agendaBloqueio.findMany({
          where: { profissionalId: entrada.profissionalId, inicio: { lt: diaFim }, fim: { gt: dia } },
          select: { inicio: true, fim: true, profissionalId: true },
        }),
      ])
      const duracoes = new Map(catalogo.filter((item) => item.duracaoMinutos !== null)
        .map((item) => [item.nome, item.duracaoMinutos!]))
      if (!slotEstaLivre(inicio, servico.duracaoMinutos, entrada.profissionalId, pet.id,
        agendados, bloqueios, duracoes))
        throw new ReservaIndisponivel('Este horário acabou de ficar indisponível. Escolha outro.', 409)

      const created = await tx.agendamento.create({
        data: {
          clienteId, petId: pet.id, profissionalId: profissional.id,
          categoria: 'Estéticos', servico: servico.nome,
          dataHora: inicio, observacoes: entrada.observacoes?.trim() || null,
          status: 'agendado',
        },
        select: { id: true, dataHora: true, servico: true, status: true },
      })
      await tx.agendaEvento.create({
        data: { agendamentoId: created.id, acao: 'reservado_pelo_cliente', autorId: usuario.id },
      })
      return created
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 })
    return NextResponse.json({ reserva }, {
      status: 201, headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues[0]?.message || 'Dados inválidos.' }, { status: 400 })
    if (error instanceof ReservaIndisponivel)
      return NextResponse.json({ error: error.message }, { status: error.status })
    if ((error as { code?: string })?.code === 'P2034')
      return NextResponse.json({ error: 'O horário foi atualizado. Escolha outro disponível.' }, { status: 409 })
    console.error('cliente/agendamentos POST:', error)
    return NextResponse.json({ error: 'Não foi possível concluir sua reserva. Tente novamente.' }, { status: 500 })
  }
}
