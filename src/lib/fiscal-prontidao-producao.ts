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
  empresa, certificadoRegistrado, produtosAtivos, produtosSemClassificacao, operacional,
}:{
  empresa: ConfigFiscalReadiness
  certificadoRegistrado: boolean
  produtosAtivos: number
  operacional?: {estrutura:boolean;serie:boolean;regras:boolean;homologacao:boolean;habilitada:boolean}
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
  add('tributos-2026',!!operacional?.regras,'Regras de produção por SKU',
    'Cada item precisa de regra contábil vigente e aprovação para o SKU, a operação e o ambiente.')
  add('assinatura',!!operacional?.homologacao,'Assinatura A1',
    'A assinatura do A1 é verificada no preparo e novamente antes de cada transmissão.')
  add('numeracao',!!operacional?.serie,'Conciliação da série 2',
    'O próximo número depende do histórico de todos os emissores e da exclusividade da série.')
  add('homologacao',!!operacional?.homologacao,'Autorização em homologação',
    'O ERP confere a chave, o protocolo e o XML autorizado do emitente na série 2 de homologação.')
  add('documentos',!!operacional?.estrutura,'Estrutura de emissão no banco',
    'O ERP persiste a reserva, o histórico das tentativas e os documentos de autorização e cancelamento.')
  add('liberacao',!!operacional?.habilitada,'Liberação do emissor',
    'Cada venda selecionada passa por conferência dos dados, assinatura A1 e validação XSD antes da transmissão.')
  return {
    ambienteSelecionado:empresa?.ambiente || 'homologacao',
    modelo:'55',
    emissaoRealHabilitada:!!operacional?.habilitada,
    aviso:'Este quadro mede requisitos de NF-e REAL em produção, não a disponibilidade do teste em homologação. Configurar produção no cadastro não habilita emissão.',
    requisitos:itens,
    concluido:itens.filter(i=>i.ok).length,
    total:itens.length,
  }
}
