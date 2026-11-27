import { db } from '@/lib/db'
import { listarServicosParaConfiguracao } from '@/lib/catalogo-servicos-matilha'
import { grupoParaRaca } from '@/lib/servicos-grupos-porte'
import { diaSaoPaulo, lerServicosDia, profissionaisDisponiveis } from '@/lib/agenda-servicos-dia'

export async function consultarCatalogoPublico(raca: string | null, desiredAt: Date) {
  const dia = diaSaoPaulo(desiredAt)
  const [configs, escala, profissionais] = await Promise.all([
    db.servicoEsteticoConfig.findMany(),
    db.agendaServicoDia.findUnique({ where: { dia } }),
    db.profissionalAgenda.findMany({ where: { ativo: true }, select: { id: true } }),
  ])
  const catalogo = listarServicosParaConfiguracao(configs).filter(s => s.gruposConfirmados)
  const porRaca = catalogo.flatMap(s => {
    const grupo = grupoParaRaca(s.gruposPorte, raca)
    return grupo ? [{ chave: s.chave, nome: s.nome, precoCentavos: grupo.precoCentavos!, duracaoMinutos: grupo.duracaoMinutos! }] : []
  })
  if (!porRaca.length) return { motivo: 'raca-nao-cadastrada', servicos: [] as typeof porRaca }
  if (!escala) return { motivo: 'dia-sem-escala', servicos: [] as typeof porRaca }
  const escalaDia = lerServicosDia(escala.servicos)
  const ids = [...new Set(escalaDia.flatMap(s => s.profissionais))]
  const fimMaximo = new Date(desiredAt.getTime() + 720 * 60_000)
  const bloqueios = await db.agendaBloqueio.findMany({
    where: { profissionalId: { in: ids }, inicio: { lt: fimMaximo }, fim: { gt: desiredAt } },
    select: { profissionalId: true, inicio: true, fim: true },
  })
  const ativos = new Set(profissionais.map(p => p.id))
  const servicos = porRaca.filter(s => {
    const item = escalaDia.find(e => e.chave === s.chave)
    const fim = new Date(desiredAt.getTime() + s.duracaoMinutos * 60_000)
    return item && diaSaoPaulo(new Date(fim.getTime() - 1)) === dia && profissionaisDisponiveis(item.profissionais, ativos, bloqueios, desiredAt, fim).length > 0
  })
  // A lista não constitui uma reserva; a equipe confirma a capacidade da agenda.
  return { motivo: servicos.length ? null : 'sem-servicos-disponiveis', servicos }
}
