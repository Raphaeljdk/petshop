import { SERVICOS_ESTETICOS_MATILHA } from './agenda-servicos'
import { lerPrecosPorRaca } from './precos-por-raca'
import { lerGruposPorte, gruposPorteConfirmaveis } from './servicos-grupos-porte'

/**
 * Fonte unica para a configuracao interna. A chave nunca vem de dados de clientes.
 * Os registros nao habilitam automaticamente reserva ou publicacao de valores.
 */
export function slugServico(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Chave determinística: o banco impede o mesmo serviço personalizado duas vezes.
export function chaveServicoPersonalizado(nome: string): string {
  return 'personalizado-' + slugServico(nome)
}

export const CATALOGO_ESTETICO_MATILHA = SERVICOS_ESTETICOS_MATILHA.map((nome) => ({
  chave: slugServico(nome),
  nome,
}))

export type ConfiguracaoServico = {
  chave: string
  nome?: string | null
  precoCentavos: number | null
  precosPorRaca?: unknown
  gruposPorte?: unknown
  duracaoMinutos: number | null
  regrasPreco: string | null
  observacoes: string | null
  confirmado: boolean
  updatedAt: Date | string | null
}

export function possuiPrecoOuRegra(precoCentavos: number | null, regrasPreco: string | null, precosPorRaca?: unknown) {
  return precoCentavos !== null || !!regrasPreco?.trim() || lerPrecosPorRaca(precosPorRaca).length > 0
}

export function configuracaoPodeSerConfirmada(data: {
  precoCentavos: number | null
  duracaoMinutos: number | null
  regrasPreco: string | null
  precosPorRaca?: unknown
}) {
  return data.duracaoMinutos !== null && possuiPrecoOuRegra(data.precoCentavos, data.regrasPreco, data.precosPorRaca)
}

export function listarServicosParaConfiguracao(registros: ConfiguracaoServico[]) {
  const porChave = new Map(registros.map((item) => [item.chave, item]))
  const personalizados = registros
    .filter(item => item.chave.startsWith('personalizado-') && !!item.nome?.trim())
    .map(item => ({ chave: item.chave, nome: item.nome!.trim() }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return [...CATALOGO_ESTETICO_MATILHA, ...personalizados].map((servico) => ({
    ...servico,
    precoCentavos: porChave.get(servico.chave)?.precoCentavos ?? null,
    precosPorRaca: lerPrecosPorRaca(porChave.get(servico.chave)?.precosPorRaca),
    gruposPorte: lerGruposPorte(porChave.get(servico.chave)?.gruposPorte),
    gruposConfirmados: Boolean(porChave.get(servico.chave)?.confirmado && gruposPorteConfirmaveis(porChave.get(servico.chave)?.gruposPorte)),
    duracaoMinutos: porChave.get(servico.chave)?.duracaoMinutos ?? null,
    regrasPreco: porChave.get(servico.chave)?.regrasPreco ?? null,
    observacoes: porChave.get(servico.chave)?.observacoes ?? null,
    confirmado: porChave.get(servico.chave)?.confirmado ?? false,
    updatedAt: porChave.get(servico.chave)?.updatedAt ?? null,
  }))
}
