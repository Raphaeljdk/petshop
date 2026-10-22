/**
 * Correspondência fiscal por escopo estrito. Nunca inferir impostos apenas do NCM.
 * Regra aplicável apenas ao cenário de revenda para consumidor final
 * não contribuinte, dentro de SP, e somente se revisada/cadastrada.
 */
export type ConsultaTributariaEntrada = {
  ncm: string
  cfop: string
  origem: string
  ufDestino: string
  indicadorIE: string
}

export type RegraTributariaConsulta = ConsultaTributariaEntrada & {
  id: string
  csosn: string
  pisCst: string
  cofinsCst: string
  ativo: boolean
  vigenteDesde?: Date | string | null
  vigenteAte?: Date | string | null
}

export function escopoConsultaCompleto(entrada: ConsultaTributariaEntrada): boolean {
  return /^\d{8}$/.test(entrada.ncm) && /^5\d{3}$/.test(entrada.cfop) &&
    /^[0-8]$/.test(entrada.origem) && entrada.ufDestino === 'SP' && entrada.indicadorIE === '9'
}

export function regraFiscalSeAplica(regra: RegraTributariaConsulta, entrada: ConsultaTributariaEntrada, em = new Date()): boolean {
  if (!escopoConsultaCompleto(entrada) || !regra.ativo) return false
  if (regra.ncm !== entrada.ncm || regra.cfop !== entrada.cfop ||
      regra.origem !== entrada.origem || regra.ufDestino !== entrada.ufDestino ||
      regra.indicadorIE !== entrada.indicadorIE) return false
  if (regra.vigenteDesde && new Date(regra.vigenteDesde) > em) return false
  if (regra.vigenteAte && new Date(regra.vigenteAte) < em) return false
  return true
}

export function selecionarRegraFiscal<T extends RegraTributariaConsulta>(
  regras: T[], entrada: ConsultaTributariaEntrada, em = new Date(),
): {status:'encontrada'|'sem_regra'|'ambigua'|'escopo_incompleto'; regra:T|null} {
  if (!escopoConsultaCompleto(entrada)) return {status:'escopo_incompleto',regra:null}
  const candidatas = regras.filter(r=>regraFiscalSeAplica(r, entrada, em))
  if (candidatas.length===1) return {status:'encontrada',regra:candidatas[0]}
  return {status:candidatas.length>1?'ambigua':'sem_regra',regra:null}
}

export const LABELS_ALIQUOTAS = {
  aliquotaIcmsSt:'ICMS-ST', aliquotaPis:'PIS', aliquotaCofins:'COFINS',
  aliquotaIpi:'IPI', aliquotaFcpSt:'FCP-ST',
  aliquotaIbsUf:'IBS estadual', aliquotaIbsMun:'IBS municipal', aliquotaCbs:'CBS',
} as const satisfies Record<string,string>
