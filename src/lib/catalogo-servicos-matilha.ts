import { SERVICOS_ESTETICOS_MATILHA } from './agenda-servicos'
import { chaveRaca, lerPrecosPorRaca } from './precos-por-raca'
import { lerGruposPorte, gruposPorteConfirmaveis, grupoParaRaca } from './servicos-grupos-porte'

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

export const REGRA_PRECO_FIXO = 'Preço único para todos os portes'
export function servicoPrecoFixo(chave: string, nome?: string|null) {
  const k = slugServico(nome || chave.replace(/^personalizado-/, ''))
  return ['banho','tosa-higienica','corte-de-unha','corte-de-unhas','remocao-de-sub-pelos','remocao-de-subpelos','remocao-de-subpelos-e-pelos-mortos','desembolo','tosa','tosa-modalidade-a-definir','escovacao-de-dente','escovacao-de-dentes'].includes(k)
}
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
    precoFixo: servicoPrecoFixo(servico.chave, servico.nome),
    gruposConfirmados: Boolean(porChave.get(servico.chave)?.confirmado && (servicoPrecoFixo(servico.chave,servico.nome)
      ? porChave.get(servico.chave)?.regrasPreco === REGRA_PRECO_FIXO && porChave.get(servico.chave)?.precoCentavos != null && porChave.get(servico.chave)?.duracaoMinutos != null
      : gruposPorteConfirmaveis(porChave.get(servico.chave)?.gruposPorte))),
    duracaoMinutos: porChave.get(servico.chave)?.duracaoMinutos ?? null,
    regrasPreco: porChave.get(servico.chave)?.regrasPreco ?? null,
    observacoes: porChave.get(servico.chave)?.observacoes ?? null,
    confirmado: porChave.get(servico.chave)?.confirmado ?? false,
    updatedAt: porChave.get(servico.chave)?.updatedAt ?? null,
  }))
}

export function catalogoPorRaca(registros: ConfiguracaoServico[], raca: string | null) {
  const todos = listarServicosParaConfiguracao(registros)
  const opcoes:Array<{chave:string;nome:string;precoCentavos:number;duracaoMinutos:number}>=[]
  const pendentes:Array<{chave:string;nome:string}>=[]
  if (!raca?.trim()) return { todos, opcoes, pendentes }
  for (const s of todos) {
    const grupo=grupoParaRaca(s.gruposPorte,raca)
    const anterior=s.precosPorRaca.find(p=>chaveRaca(p.raca)===chaveRaca(raca))
    if(s.precoFixo) {
      // O preço único vale para todo porte; durações específicas anteriores continuam válidas.
      if(s.gruposConfirmados && s.precoCentavos!==null && s.duracaoMinutos!==null) opcoes.push({chave:s.chave,nome:s.nome,precoCentavos:s.precoCentavos,duracaoMinutos:grupo?.duracaoMinutos??s.duracaoMinutos})
      else pendentes.push({chave:s.chave,nome:s.nome})
    } else if(s.confirmado && grupo && grupo.precoCentavos!==null && grupo.duracaoMinutos!==null) {
      opcoes.push({chave:s.chave,nome:s.nome,precoCentavos:grupo.precoCentavos,duracaoMinutos:grupo.duracaoMinutos})
    } else if(s.confirmado && anterior && s.duracaoMinutos!==null && !s.gruposPorte.some(g=>g.racas.length)) {
      opcoes.push({chave:s.chave,nome:s.nome,precoCentavos:anterior.precoCentavos,duracaoMinutos:s.duracaoMinutos})
    } else if(grupo || anterior || s.gruposPorte.some(g=>g.racas.some(r=>chaveRaca(r)===chaveRaca(raca)))) {
      pendentes.push({chave:s.chave,nome:s.nome})
    }
  }
  return { todos, opcoes, pendentes }
}
