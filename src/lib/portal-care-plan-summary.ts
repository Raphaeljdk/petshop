/**
 * Resumo de sessões baseado apenas no plano registrado e nas baixas confirmadas pela equipe.
 * Um pacote vencido ou cancelado não gera sessões disponíveis, mesmo que haja saldo não usado.
 */
export type SituacaoPlano = 'ativo' | 'esgotado' | 'vencido' | 'cancelado' | 'pendente'

export type PlanoComSaldo = {
  status: string
  sessionsUsed: number
  startsAt?: Date | string | null
  expiresAt: Date | string | null
  plan: { sessions: number }
}

export function resumirPlanoDeCuidados(registro: PlanoComSaldo, agora: Date = new Date()) {
  const total = Math.max(0, Math.trunc(registro.plan.sessions))
  const utilizadas = Math.min(total, Math.max(0, Math.trunc(registro.sessionsUsed)))
  const restantes = Math.max(0, total - utilizadas)
  const vencido = registro.expiresAt !== null && new Date(registro.expiresAt).getTime() <= agora.getTime()
  const situacao: SituacaoPlano =
    registro.status === 'cancelado' ? 'cancelado' :
    registro.status !== 'ativo' ? 'pendente' :
    vencido ? 'vencido' :
    restantes === 0 ? 'esgotado' : 'ativo'

  return {
    total,
    utilizadas,
    restantes,
    disponiveis: situacao === 'ativo' ? restantes : 0,
    situacao,
  }
}
