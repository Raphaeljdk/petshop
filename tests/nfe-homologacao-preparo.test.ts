import {test} from 'node:test'
import assert from 'node:assert/strict'
import {prepararPrimeiraHomologacao,SKU_TESTE_INICIAL,PRODUTO_TESTE_INICIAL_ID} from '../src/lib/nfe-homologacao-preparo'
const produto={
  id:PRODUTO_TESTE_INICIAL_ID,nome:'Arm & Hammer Enxágue Dental 473 ml Brinquedo Resistente Borracha Para Cães Grandes Preto',sku:SKU_TESTE_INICIAL,ativo:true,
  preco:136.9,ncm:'33061000',gtinFiscal:SKU_TESTE_INICIAL,cfop:'5102',
  csosn:'102',pisCst:'49',cofinsCst:'49',cest:null,origem:'0',unidadeFiscal:'UN',
}
const empresa={
  cnpj:'00000000000000',inscricaoEstadual:'123456',regimeTributario:'1',
  serieNfe:1,ambiente:'producao',uf:'SP',razaoSocial:'Exemplo',
}
const historico=[
  {serie:1,numero:1084,emissor:'mercado_livre',status:'autorizada'},
  {serie:1,numero:1077,emissor:'mercado_livre',status:'autorizada'},
  {serie:2,numero:9999,emissor:'outro',status:'autorizada'},
]
test('seleciona produto real e retorna diagnóstico sem liberar envio ou criar venda',()=>{
 const original=structuredClone({produto,empresa,historico})
 const r=prepararPrimeiraHomologacao({
   produto,emitente:empresa,documentos:historico,regrasAprovadas:0,certificadoConfigurado:true,
 })
 assert.equal(r.produto?.sku,SKU_TESTE_INICIAL)
 assert.equal(r.tpAmbPlanejado,2)
 assert.equal(r.criacaoDeVenda,false)
 assert.equal(r.alteracaoDeEstoque,false)
 assert.equal(r.envioSefaz,false)
 assert.equal(r.liberadoParaTransmitir,false)
 assert.equal(r.historico.maiorNumeroConhecidoNaSerie,1084)
 assert.equal(r.historico.numeroProximoConfirmado,false)
 assert.equal(r.historico.notasComNumeroNaSerie,2)
 assert.ok(r.pendencias.some(s=>s.includes('CST 49')))
 assert.ok(r.pendencias.some(s=>s.includes('XMLDSig')))
 assert.ok(r.pendencias.some(s=>s.includes('Nenhuma NF-e 55 própria autorizada')))
 assert.equal(r.emissaoRealHabilitada,false)
 assert.equal(r.nfeAutorizadasEmHomologacao,0)
 assert.equal(r.homologacaoDisponivelParaTeste,false)
 assert.deepEqual({produto,empresa,historico},original)
})
test('produto ou regras ausentes mantêm o emissor bloqueado',()=>{
 const r=prepararPrimeiraHomologacao({
  produto:null,emitente:null,documentos:[],regrasAprovadas:0,certificadoConfigurado:false,
 })
 assert.equal(r.produto,null)
 assert.equal(r.liberadoParaTransmitir,false)
 assert.ok(r.pendencias.some(x=>x.includes('Produto')))
 assert.ok(r.pendencias.some(x=>x.includes('contador')))
 assert.ok(r.pendencias.some(x=>x.includes('A1')))
})
test('mesmo com regra cadastrada, não presume número livre ou autorização SEFAZ',()=>{
 const r=prepararPrimeiraHomologacao({
  produto:{...produto,pisCst:'07',cofinsCst:'07'},
  emitente:empresa,documentos:historico,regrasAprovadas:1,certificadoConfigurado:true,
 })
 assert.equal(r.liberadoParaTransmitir,false)
 assert.equal(r.historico.numeroProximoConfirmado,false)
 assert.equal(r.envioSefaz,false)
})

test('autorização registrada em homologação não habilita automaticamente notas reais',()=>{
 const resultado=prepararPrimeiraHomologacao({
  produto,emitente:{...empresa,serieNfe:2},documentos:historico,
  regrasAprovadas:1,certificadoConfigurado:true,autorizacoesHomologacao:1,
 })
 assert.equal(resultado.homologacaoDisponivelParaTeste,true)
 assert.equal(resultado.nfeAutorizadasEmHomologacao,1)
 assert.equal(resultado.emissaoRealHabilitada,false)
 assert.equal(resultado.liberadoParaTransmitir,false)
 assert.ok(!resultado.pendencias.some(p=>p.includes('Nenhuma NF-e 55 própria autorizada')))
})

test('Arm & Hammer 473 ml com dados fiscais ausentes não pode preparar NF-e de teste',()=>{
 const resultado=prepararPrimeiraHomologacao({
  produto:{...produto,cfop:null,csosn:null,pisCst:null,cofinsCst:null},
  emitente:{...empresa,serieNfe:2},documentos:[],
  regrasAprovadas:0,certificadoConfigurado:true,
 })
 assert.equal(resultado.produto?.nome,produto.nome)
 assert.equal(resultado.produto?.ncm,'33061000')
 assert.equal(resultado.homologacaoDisponivelParaTeste,false)
 assert.ok(resultado.pendenciasProduto.some(p=>p.includes('CFOP')))
 assert.ok(resultado.pendenciasProduto.some(p=>p.includes('CSOSN')))
 assert.ok(resultado.pendenciasProduto.some(p=>p.includes('CST PIS')))
 assert.ok(resultado.pendenciasProduto.some(p=>p.includes('aprova')))
})
test('rejeita escolha ambígua por SKU de outro cadastro Arm & Hammer 473 ml e não habilita produção',()=>{
 const resultado=prepararPrimeiraHomologacao({
  produto:{...produto,id:'outro-produto-com-mesmo-sku'},
  emitente:{...empresa,serieNfe:2},documentos:[],
  regrasAprovadas:1,certificadoConfigurado:true,
 })
 assert.equal(resultado.homologacaoDisponivelParaTeste,false)
 assert.equal(resultado.emissaoRealHabilitada,false)
 assert.ok(resultado.pendenciasProduto.some(p=>p.includes('não corresponde')))
})
