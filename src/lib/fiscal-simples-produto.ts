/**
 * Configuração de classificação fiscal por produto para ME/EPP optante do Simples (CRT 1).
 * Os códigos são declarados pelo contador. Este módulo NÃO determina incidência,
 * alíquotas, créditos, ST, FCP, CBS/IBS, nem autoriza notas.
 * A tributação final pode mudar conforme UF, destinatário e natureza da operação.
 */
export type CamposFiscaisSimples = {
  ncm?: string | null
  cest?: string | null
  cfop?: string | null
  origem?: string | null
  csosn?: string | null
  unidadeFiscal?: string | null
  gtinFiscal?: string | null
  pisCst?: string | null
  cofinsCst?: string | null
  ipiCst?: string | null
  ibsCbsCst?: string | null
  ibsCbsClassTrib?: string | null
}

export const CSOSN_SIMPLES = [
  '101','102','103','201','202','203','300','400','500','900',
] as const

// Tabelas de CST de PIS/COFINS são independentes do código CSOSN do ICMS.
export const CST_PIS_COFINS = [
  '01','02','03','04','05','06','07','08','09',
  '49','50','51','52','53','54','55','56',
  '60','61','62','63','64','65','66','67',
  '70','71','72','73','74','75','98','99',
] as const

export const CST_IPI = [
  '00','01','02','03','04','05','49',
  '50','51','52','53','54','55','99',
] as const

const somenteDigitos = (value: string | null | undefined) => (value || '').replace(/\D/g, '')
const preenchido = (value: string | null | undefined) => !!value?.trim()
const valido = (value: string | null | undefined, list: readonly string[]) =>
  !preenchido(value) || list.includes(value!.trim())

export function validarCamposFiscaisSimples(p: CamposFiscaisSimples): string[] {
  const erros: string[] = []
  if (preenchido(p.ncm) && !/^\d{8}$/.test(somenteDigitos(p.ncm))) erros.push('NCM deve ter oito dígitos.')
  if (preenchido(p.cest) && !/^\d{7}$/.test(somenteDigitos(p.cest))) erros.push('CEST deve ter sete dígitos.')
  if (preenchido(p.cfop) && !/^\d{4}$/.test(somenteDigitos(p.cfop))) erros.push('CFOP deve ter quatro dígitos.')
  if (preenchido(p.origem) && !/^[0-8]$/.test(p.origem!.trim())) erros.push('Origem deve ser um código de 0 a 8.')
  if (!valido(p.csosn, CSOSN_SIMPLES)) erros.push('CSOSN não pertence à tabela do Simples Nacional (CRT 1).')
  if (!valido(p.pisCst, CST_PIS_COFINS)) erros.push('CST de PIS inválido.')
  if (!valido(p.cofinsCst, CST_PIS_COFINS)) erros.push('CST de COFINS inválido.')
  if (!valido(p.ipiCst, CST_IPI)) erros.push('CST de IPI inválido.')
  if (preenchido(p.ibsCbsCst) && !/^\d{3}$/.test(p.ibsCbsCst!.trim())) erros.push('CST IBS/CBS deve ter três dígitos.')
  if (preenchido(p.ibsCbsClassTrib) && !/^\d{6}$/.test(p.ibsCbsClassTrib!.trim())) erros.push('cClassTrib IBS/CBS deve ter seis dígitos.')
  if (!!preenchido(p.ibsCbsCst) !== !!preenchido(p.ibsCbsClassTrib))
    erros.push('CST e cClassTrib IBS/CBS devem ser preenchidos em conjunto pelo contador.')
  const ean = p.gtinFiscal?.trim().toUpperCase()
  if (ean && ean !== 'SEM GTIN' && !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(ean))
    erros.push('GTIN precisa ter 8, 12, 13 ou 14 dígitos, ou SEM GTIN quando permitido.')
  if (preenchido(p.unidadeFiscal) && !/^[A-Z0-9]{1,6}$/.test(p.unidadeFiscal!.trim().toUpperCase()))
    erros.push('Unidade fiscal inválida.')
  return erros
}

/** Pendências de classificação, não um parecer de que impostos foram calculados. */
export function pendenciasClassificacaoSimples(p: CamposFiscaisSimples): string[] {
  const pendencias = validarCamposFiscaisSimples(p)
  if (!/^\d{8}$/.test(somenteDigitos(p.ncm))) pendencias.push('NCM pendente.')
  if (!/^\d{4}$/.test(somenteDigitos(p.cfop))) pendencias.push('CFOP de referência pendente; confirmar destino.')
  if (!preenchido(p.csosn)) pendencias.push('CSOSN pendente.')
  if (!preenchido(p.pisCst)) pendencias.push('CST PIS pendente.')
  if (!preenchido(p.cofinsCst)) pendencias.push('CST COFINS pendente.')
  if (!preenchido(p.gtinFiscal)) pendencias.push('GTIN não confirmado.')
  if (!preenchido(p.unidadeFiscal)) pendencias.push('Unidade fiscal pendente.')
  if (['201','202','203','500','900'].includes(p.csosn || ''))
    pendencias.push('ICMS-ST/outros: conferir bases, alíquotas, valores e grupos XML específicos.')
  // IPI, FCP e IBS/CBS dependem de operação, produto e calendário. Nunca
  // inferir "zero" a partir do regime Simples Nacional.
  return pendencias
}

export function mensagemSimples() {
  return 'CRT 1 — Simples Nacional. Códigos por produto são referência fiscal, não autorização. ' +
    'ICMS-ST, FCP, IPI, PIS/COFINS, IBS/CBS e regras por destino precisam de validação contábil. ' +
    'O emissor próprio NF-e continua bloqueado até assinatura, XSD e homologação.'
}
