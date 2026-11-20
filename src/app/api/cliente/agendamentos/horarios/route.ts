import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { listarServicosParaConfiguracao } from '@/lib/catalogo-servicos-matilha'
import { dataReservavel, gerarSlots, slotEstaLivre, timestampBrasilia } from '@/lib/agenda-online'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getUsuarioLogado()
  if (!user?.cliente || user.role !== 'CLIENTE')
    return NextResponse.json({ error: 'Cliente não autenticado.' }, { status: 401 })
  try {
    const [config, rows, profissionais] = await Promise.all([
      db.agendaOnlineConfig.findUnique({ where: { id: 'padrao' } }),
      db.servicoEsteticoConfig.findMany(),
      db.profissionalAgenda.findMany({
        where: { ativo: true }, orderBy: { nome: 'asc' },
        select: { id: true, nome: true, especialidades: true },
      }),
    ])
    const catalogo = listarServicosParaConfiguracao(rows)
    const services = catalogo
      .filter((s) => s.confirmado && s.duracaoMinutos !== null)
      .map((s) => ({ chave: s.chave, nome: s.nome, duracaoMinutos: s.duracaoMinutos! }))
    const base = {
      enabled: Boolean(config?.enabled),
      services,
      professionals: profissionais,
      slots: [] as Array<{ inicio: string; hora: string }>,
    }
    const data = request.nextUrl.searchParams.get('data')
    const servico = request.nextUrl.searchParams.get('servico')
    const profissionalId = request.nextUrl.searchParams.get('profissionalId')
    if (!data || !servico || !profissionalId) return NextResponse.json(base, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
    const item = services.find((s) => s.chave === servico)
    const profissional = profissionais.find((p) => p.id === profissionalId)
    if (!config?.enabled || !item || !profissional || !dataReservavel(data, config))
      return NextResponse.json(base, { headers: { 'Cache-Control': 'private, no-store' } })

    const inicioDia = timestampBrasilia(data, 0)
    const fimDia = new Date(inicioDia.getTime() + 86400_000)
    const [agendados, bloqueios] = await Promise.all([
      db.agendamento.findMany({
        where: { dataHora: { gte: new Date(inicioDia.getTime() - 720 * 60000), lt: fimDia },
          status: { in: ['agendado', 'confirmado'] } },
        select: { dataHora: true, servico: true, profissionalId: true, petId: true, status: true },
      }),
      db.agendaBloqueio.findMany({
        where: { inicio: { lt: fimDia }, fim: { gt: inicioDia }, profissionalId },
        select: { inicio: true, fim: true, profissionalId: true },
      }),
    ])
    const duracoes = new Map(catalogo.filter((s) => s.duracaoMinutos !== null).map((s) => [s.nome, s.duracaoMinutos!]))
    const formatarHora = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo',
    })
    const slots = gerarSlots(data, item.duracaoMinutos, config)
      .filter((slot) => slotEstaLivre(slot, item.duracaoMinutos, profissionalId, null, agendados, bloqueios, duracoes))
      .map((slot) => ({ inicio: slot.toISOString(), hora: formatarHora.format(slot) }))
    return NextResponse.json({ ...base, slots }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('consulta agendamento online:', error)
    return NextResponse.json({ error: 'Não foi possível consultar os horários. Tente novamente.' }, { status: 500 })
  }
}
