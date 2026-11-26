/**
 * Preparação somente leitura da primeira NF-e 55 em homologação.
 * Nunca cria venda, movimenta estoque, reserva numeração ou chama a SEFAZ.
 */
export type ProdutoHomologacao = {
  id:string;nome:string;sku:string|null;ativo:boolean;preco:number
  ncm:string|null;gtinFiscal:string|null;cfop:string|null;csosn:string|null
  pisCst:string|null;cofinsCst:string|null;cest:string|null
  origem:string|null;unidadeFiscal:string|null
}
export type EmitenteHomologacao = {
  cnpj:string|null;inscricaoEstadual:string|null;regimeTributario:string|null
  apuracaoTributaria?:string|null
  serieNfe:number;ambiente:string;uf:string|null
  razaoSocial:string|null
}
export type NumeroEmitido = {
  serie:number|null;numero:number|null;emissor:string|null;status:string
}
const filled=(v:string|null|undefined)=>!!v?.trim()
const formato=(v:string|null|undefined,pattern:RegExp)=>pattern.test(v?.trim()||'')
// Seleção por ID: o mesmo nome aparece em cadastros distintos com SKUs diferentes.
// Este cadastro possui classificação preenchida, mas ainda exige regra fiscal aprovada.
export const PRODUTO_TESTE_INICIAL_ID='cmund1rbu003il0042pqww20r'
export const SKU_TESTE_INICIAL='742797096780'
export function prepararPrimeiraHomologacao(input:{
  produto:ProdutoHomologacao|null;emitente:EmitenteHomologacao|null
  documentos:NumeroEmitido[];regrasAprovadas:number;certificadoConfigurado:boolean
  autorizacoesHomologacao?:number
}){
  const {produto:p,emitente:e,documentos,regrasAprovadas,certificadoConfigurado}=input
  const autorizacoesHomologacao=input.autorizacoesHomologacao??0
  const serie=e?.serieNfe??null
  const numerosNaSerie=documentos.filter(n=>n.serie===serie&&n.numero!=null)
  const numeroMaximo=numerosNaSerie.length?Math.max(...numerosNaSerie.map(n=>n.numero||0)):null
  const observacoes:string[]=[]
  const pendenciasProduto:string[]=[]
  const faltando=(mensagem:string)=>{observacoes.push(mensagem);pendenciasProduto.push(mensagem)}
  if(!p)faltando('Produto Arm & Hammer Enxágue Dental 473 ml não encontrado no catálogo.')
  else {
    if(p.id!==PRODUTO_TESTE_INICIAL_ID||p.sku!==SKU_TESTE_INICIAL)
      faltando('O produto selecionado não corresponde ao Arm & Hammer Enxágue Dental 473 ml escolhido para o teste.')
    if(!p.ativo)faltando('Produto de referência inativo.')
    if(!formato(p.ncm,/^\d{8}$/))faltando('NCM ausente ou fora do formato de oito dígitos.')
    if(!formato(p.gtinFiscal,/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/))
      faltando('GTIN fiscal não identificado em formato padrão; conferir fabricante/GS1.')
    if(!formato(p.cfop,/^5\d{3}$/))
      faltando('CFOP do Arm & Hammer 473 ml pendente ou incompatível com operação interna em SP.')
    if(!formato(p.csosn,/^(101|102|103|201|202|203|300|400|500|900)$/))
      faltando('CSOSN do Arm & Hammer 473 ml ausente ou inválido.')
    if(!filled(p.pisCst)||!filled(p.cofinsCst))
      faltando('CST PIS e COFINS do Arm & Hammer 473 ml ainda não foram preenchidos.')
    if(!filled(p.unidadeFiscal)||!filled(p.origem))
      faltando('Origem ou unidade fiscal pendente.')
  }
  // O gerador implementado neste primeiro teste suporta somente CSOSN 102 e CST 49.
  // Não copiar classificação de outro produto: somente uma regra fiscal APROVADA deve respaldar o Arm & Hammer.
  if(p?.csosn&&p.csosn!=='102')
    faltando('O CSOSN informado para o Arm & Hammer 473 ml requer implementação própria antes da NF-e de teste.')
  if((p?.pisCst&&p.pisCst!=='49')||(p?.cofinsCst&&p.cofinsCst!=='49'))
    faltando('O CST PIS/COFINS do Arm & Hammer 473 ml exige tratamento específico; o emissor inicial só prepara CST 49.')

  if(e?.regimeTributario==='1'&&e.apuracaoTributaria!=='PGDAS_D')
    observacoes.push('Apuração do Simples Nacional ainda não configurada como PGDAS-D/DAS. Não aplicar rateio de impostos na NF-e.')
  if(!e||e.regimeTributario!=='1'||e.uf!=='SP'||!filled(e.cnpj)||!filled(e.inscricaoEstadual))
    observacoes.push('Dados fiscais do emitente CRT 1 / SP incompletos ou não confirmados.')
  if(!certificadoConfigurado)observacoes.push('Variáveis protegidas do certificado A1 indisponíveis no servidor.')
  if(regrasAprovadas===0)faltando('Falta registrar no ERP a regra fiscal do Arm & Hammer 473 ml aprovada pela contadora, incluindo NCM, CFOP, CSOSN, PIS/COFINS e CEST ou sua dispensa.')
  observacoes.push('A série 2 deve continuar exclusiva do emissor próprio. Conferir o histórico externo antes de reservar numeração real.')
  if(autorizacoesHomologacao===0)
    observacoes.push('Nenhuma NF-e 55 própria autorizada em homologação consta no banco. Preparar, assinar, validar e transmitir o teste para obter cStat 100 e protocolo.')
  observacoes.push('O teste usa assinatura XMLDSig e os valores de CST 49 aprovados para o produto. Confira a liberação das vendas no painel do emitente.')
  observacoes.push('Tributação PIS/COFINS e IBS/CBS deve estar aprovada para cada operação; códigos preenchidos não comprovam cálculo validado.')
  return {
    tipo:'PREPARACAO_NFE_55_HOMOLOGACAO',
    modo:'somente_leitura',
    tpAmbPlanejado:2,
    criacaoDeVenda:false,alteracaoDeEstoque:false,envioSefaz:false,
    liberadoParaTransmitir:false,
    homologacaoDisponivelParaTeste:!!(certificadoConfigurado&&p?.ativo&&
      p.id===PRODUTO_TESTE_INICIAL_ID&&p.sku===SKU_TESTE_INICIAL&&
      formato(p.ncm,/^\d{8}$/)&&formato(p.gtinFiscal,/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/)&&
      formato(p.cfop,/^5\d{3}$/)&&p.csosn==='102'&&
      p.pisCst==='49'&&p.cofinsCst==='49'&&filled(p.unidadeFiscal)&&
      filled(p.origem)&&regrasAprovadas>0&&e?.serieNfe===2&&e?.uf==='SP'&&e.regimeTributario==='1'&&e.apuracaoTributaria==='PGDAS_D'),
    pendenciasProduto,
    nfeAutorizadasEmHomologacao:autorizacoesHomologacao,
    emissaoRealHabilitada:false,
    produto:p?{
      id:p.id,nome:p.nome,sku:p.sku,ativo:p.ativo,preco:p.preco,
      ncm:p.ncm,gtinFiscal:p.gtinFiscal,cfop:p.cfop,csosn:p.csosn,
      pisCst:p.pisCst,cofinsCst:p.cofinsCst,cest:p.cest,
      origem:p.origem,unidadeFiscal:p.unidadeFiscal,
    }:null,
    emitente:{
      crt:e?.regimeTributario||null,apuracaoTributaria:e?.apuracaoTributaria||null,uf:e?.uf||null,
      serieCadastrada:serie,ambienteAtual:e?.ambiente||null,
      a1VariaveisPresentes:certificadoConfigurado,
    },
    historico:{
      notasComNumeroNaSerie:numerosNaSerie.length,
      maiorNumeroConhecidoNaSerie:numeroMaximo,
      quantidadeNotasEmitidasPorMarketplace:numerosNaSerie.filter(n=>!!n.emissor).length,
      numeroProximoConfirmado:false,
      observacao:'O maior número conhecido no ERP NÃO comprova o próximo número livre. Consultar emissões, inutilizações e outras séries.',
    },
    regrasRevisadasCadastradas:regrasAprovadas,
    pendencias:observacoes,
  }
}
