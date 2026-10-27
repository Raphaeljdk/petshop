import {test} from 'node:test'
import assert from 'node:assert/strict'
import {prepararPrimeiraHomologacao,SKU_TESTE_INICIAL} from '../src/lib/nfe-homologacao-preparo'
const produto={
  id:'p-1',nome:'Brinquedo Bola Strong Ball Pequena Jambo Pet Laranja',sku:SKU_TESTE_INICIAL,ativo:true,
  preco:52.99,ncm:'39269090',gtinFiscal:SKU_TESTE_INICIAL,cfop:'5102',
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
 assert.ok(r.pendencias.some(s=>s.includes('49')))
 assert.ok(r.pendencias.some(s=>s.includes('XSD')))
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
