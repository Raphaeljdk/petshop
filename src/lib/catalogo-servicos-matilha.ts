import { SERVICOS_ESTETICOS_MATILHA } from './agenda-servicos'

/**
 * Fonte unica para a configuracao interna. A chave nunca vem de dados de clientes.
 * Os registros nao habilitam automaticamente reserva ou publicacao de valores.
 */
export const CATALOGO_ESTETICO_MATILHA = SERVICOS_ESTETICOS_MATILHA.map((nome) => ({
  chave: nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  nome,
}))

export type ConfiguracaoServico = {
  chave: string
  precoCentavos: number | null
  duracaoMinutos: number | null
  regrasPreco: string | null
  observacoes: string | null
  confirmado: boolean
  updatedAt: Date | string | null
}

export function possuiPrecoOuRegra(precoCentavos: number | null, regrasPreco: string | null) {
  return precoCentavos !== null || !!regrasPreco?.trim()
}

export function configuracaoPodeSerConfirmada(data: {
  precoCentavos: number | null
  duracaoMinutos: number | null
  regrasPreco: string | null
}) {
  return data.duracaoMinutos !== null && possuiPrecoOuRegra(data.precoCentavos, data.regrasPreco)
}

export function listarServicosParaConfiguracao(registros: ConfiguracaoServico[]) {
  const porChave = new Map(registros.map((item) => [item.chave, item]))
  return CATALOGO_ESTETICO_MATILHA.map((servico) => ({
    ...servico,
    precoCentavos: porChave.get(servico.chave)?.precoCentavos ?? null,
    duracaoMinutos: porChave.get(servico.chave)?.duracaoMinutos ?? null,
    regrasPreco: porChave.get(servico.chave)?.regrasPreco ?? null,
    observacoes: porChave.get(servico.chave)?.observacoes ?? null,
    confirmado: porChave.get(servico.chave)?.confirmado ?? false,
    updatedAt: porChave.get(servico.chave)?.updatedAt ?? null,
  }))
}
