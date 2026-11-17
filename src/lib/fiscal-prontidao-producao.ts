/**
 * Auditoria de pré-requisitos para NF-e própria em produção.
 * Somente leitura: NÃO consulta SEFAZ, NÃO gera notas, NÃO reserva série/número.
 * Nenhuma verificação abaixo deve liberar produção automaticamente.
 */
export type ConfigFiscalReadiness = {
  razaoSocial?: string | null; cnpj?: string | null; inscricaoEstadual?: string | null
  regimeTributario?: string | null; apuracaoTributaria?: string | null; logradouro?: string | null
  numeroEndereco?: string | null; bairro?: string | null; cidade?: string | null
  uf?: string | null; cep?: string | null; codigoMunicipio?: string | null
  serieNfe?: number | null; ambiente?: string | null
} | null

export type RequisitoNfe = { id: string; ok: boolean; titulo: string; detalhe: string }
const digits = (v: string | null | undefined) => (v || '').replace(/\D/g, '')
const completo = (v: string | null | undefined) => !!v?.trim()

export function cnpjDigitosValidos(value: string | null | undefined) {
  const cnpj = digits(value)
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const resto = (cnpj.slice(0, n).split('').reduce((s, digit, i) => s + Number(digit) * pesos[i], 0)) % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return Number(cnpj[12]) === calc(12) && Number(cnpj[13]) === calc(13)
}

export function avaliarProntidaoNfeProducao({
  empresa, certificadoRegistrado, produtosAtivos, produtosSemClassificacao,
}:{
  empresa: ConfigFiscalReadiness
  certificadoRegistrado: boolean
  produtosAtivos: number
  produtosSemClassificacao: number
}) {
  const itens: RequisitoNfe[] = []
  const add = (id:string, ok:boolean, titulo:string, detalhe:string) => itens.push({id,ok,titulo,detalhe})
  const cadastroCompleto = !!empresa && cnpjDigitosValidos(empresa.cnpj)
    && completo(empresa.razaoSocial) && completo(empresa.inscricaoEstadual)
    && ['1','2','3'].includes(empresa.regimeTributario || '')
    && completo(empresa.logradouro) && completo(empresa.numeroEndereco)
    && completo(empresa.bairro) && completo(empresa.cidade)
    && empresa.uf?.trim().toUpperCase() === 'SP'
    && /^\d{8}$/.test(digits(empresa.cep))
    && /^35\d{5}$/.test(digits(empresa.codigoMunicipio))
    && Number.isInteger(empresa.serieNfe) && Number(empresa.serieNfe) >= 1
  add('cadastro',cadastroCompleto,'Emitente cadastrado',
    'CNPJ com dígitos verificadores válidos, IE, CRT, endereço SP, município IBGE e série preenchidos. Não confirma a situação cadastral na SEFAZ.')
  add('apuracao-simples',empresa?.regimeTributario==='1'&&empresa.apuracaoTributaria==='PGDAS_D',
    'Apuração do Simples Nacional parametrizada',
    'CRT 1: receitas declaradas no PGDAS-D e recolhimento pelo DAS. Não ratear o Anexo I na NF-e; ST, monofásico, antecipações e outros tratamentos exigem segregação e revisão específica.')
  add('a1-variaveis',certificadoRegistrado,'Certificado A1 configurado no servidor',
    'Confirma apenas que as variáveis protegidas estão presentes. Não prova validade, titularidade ou aceite TLS.')
  add('a1-validacao',false,'Validação do A1 e vínculo do CNPJ',
    'Validar vigência, chave privada, cadeia ICP-Brasil e vínculo com estabelecimento antes da emissão.')
  add('credenciamento',false,'Credenciamento NF-e na SEFAZ-SP',
    'Conferir situação do estabelecimento e autorização para NF-e modelo 55 nos ambientes de teste e produção.')
  add('catalogo',produtosAtivos > 0 && produtosSemClassificacao === 0,
    'Cadastro tributário dos produtos',
    produtosAtivos + ' produtos ativos; ' + produtosSemClassificacao +
    ' sem classificação mínima completa. Esta contagem é do catálogo para EMISSÃO EM MASSA; não impede sozinha o teste individual de um produto com regra aprovada.')
  add('tributos-2026',false,'Tributação vigente (IBS/CBS e demais impostos)',
    'Completar e revisar cálculo e grupos tributários conforme notas técnicas de 2026 e particularidades de cada venda.')
  add('dados-venda',false,'Dados fiscais e pagamentos da venda',
    'Persistir endereço estruturado, GTIN, indicador ICMS, operação, pagamento e rateios; conferir com pedido e transporte.')
  add('xml-xsd',false,'Validação XSD de NF-e em produção',
    'O fluxo da NF-e de TESTE já valida o XML com XSD; isso não comprova que o XML de cada venda real atende aos leiautes e regras vigentes de produção.')
  add('assinatura',false,'Assinatura XMLDSig do fluxo de produção',
    'O fluxo de TESTE já assina e verifica XMLDSig com A1. A assinatura por venda real ainda não foi implementada nem validada ponta a ponta.')
  add('numeracao',false,'Numeração e prevenção de duplicidade em produção',
    'A série 2 de HOMOLOGAÇÃO utiliza numeração isolada no banco. A reserva numérica de uma NF-e REAL e a reconciliação entre emissores ainda não existem no fluxo de produção.')
  add('homologacao',false,'Primeira NF-e própria autorizada em homologação',
    'O fluxo de teste permite preparar, assinar, transmitir e consultar NF-e em tpAmb=2. Ainda não há evidência de cStat 100, protocolo e XML autorizado no próprio ERP.')
  add('documentos',false,'Protocolo, DANFE e eventos do emissor de produção',
    'A homologação já prevê persistência do XML autorizado e protocolo. DANFE, eventos fiscais e integração com notas reais seguem pendentes.')
  return {
    ambienteSelecionado:empresa?.ambiente || 'homologacao',
    modelo:'55',
    emissaoRealHabilitada:false,
    aviso:'Este quadro mede requisitos de NF-e REAL em produção, não a disponibilidade do teste em homologação. Configurar produção no cadastro não habilita emissão.',
    requisitos:itens,
    concluido:itens.filter(i=>i.ok).length,
    total:itens.length,
  }
}
