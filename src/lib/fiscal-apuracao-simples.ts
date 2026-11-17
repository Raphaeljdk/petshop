/**
 * Regra de apuração da Matilha Prado: a receita do CRT 1 é apurada no PGDAS-D
 * e os tributos abrangidos são recolhidos por DAS, não por rateio da NF-e.
 * Este parâmetro NÃO autoriza omitir informações fiscais obrigatórias na NF-e
 * nem calcula tributos de exceções (ICMS-ST, monofásicos, etc.).
 */
export const APURACAO_SIMPLES_PGDAS_D='PGDAS_D' as const
export const APURACAO_PENDENTE='PENDENTE_VALIDACAO' as const
export type ModoApuracaoTributaria=typeof APURACAO_SIMPLES_PGDAS_D|typeof APURACAO_PENDENTE

export const apuracaoParaRegime=(crt:string|null|undefined):ModoApuracaoTributaria =>
  crt==='1'?APURACAO_SIMPLES_PGDAS_D:APURACAO_PENDENTE

export const apuracaoSimplesConfigurada=(crt:string|null|undefined,modo:string|null|undefined)=>
  crt==='1'&&modo===APURACAO_SIMPLES_PGDAS_D

/** Falha fechada para não confundir opção cadastral com tributo a destacar/cobrar. */
export function exigirApuracaoSimples(crt:string|null|undefined,modo:string|null|undefined){
  if(!apuracaoSimplesConfigurada(crt,modo))
    throw new Error('Apuração tributária não configurada como Simples Nacional / PGDAS-D. Não utilizar rateio ou imposto direto na NF-e.')
}
