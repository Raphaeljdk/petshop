import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auditarProdutoParaNfeSaida, auditarCatalogoSaida } from '../src/lib/fiscal-auditoria-saida'
const item=(id:string,cfop:string)=>({
  id,sku:'035585131214',nome:'KONG Puppy Medium',ncm:'40169990',
  cfop,csosn:'102',pisCst:'49',cofinsCst:'49',
})
test('CFOP de entrada 2102 não é válido como referência de saída',()=>{
  const r=auditarProdutoParaNfeSaida(item('a','2102'))
  assert.ok(r.some(x=>x.codigo==='CFOP_ENTRADA_EM_VENDA'&&x.severidade==='bloqueio'))
})
test('CFOP 5109 requer revisão de natureza/destino, não é modificado',()=>{
  const p=item('b','5109')
  const copy=structuredClone(p)
  const r=auditarProdutoParaNfeSaida(p)
  assert.equal(r.some(x=>x.codigo==='CFOP_5109_ESPECIAL'),true)
  assert.deepEqual(p,copy)
})
test('CFOP 5102 em revenda interna não é marcado incorretamente como erro',()=>{
  const r=auditarProdutoParaNfeSaida(item('c','5102'))
  assert.equal(r.some(x=>x.codigo.startsWith('CFOP_')),false)
})
test('PIS/COFINS 49: códigos válidos, mas ainda incompatíveis com rascunho XML do ERP',()=>{
  const r=auditarProdutoParaNfeSaida(item('d','5102'))
  assert.deepEqual(r.filter(x=>x.severidade==='tecnico').map(x=>x.codigo),
    ['PIS_49_NAO_SUPORTADO_XML','COFINS_49_NAO_SUPORTADO_XML'])
})
test('Audita apenas registros preenchidos e identifica CFOP divergente do mesmo SKU',()=>{
  const originais=[item('a','5102'),item('b','2102'),{
    id:'c',sku:'7899732118403',nome:'Buddy',ncm:null,cfop:null,
    csosn:null,pisCst:null,cofinsCst:null,
  }]
  const snapshot=structuredClone(originais)
  const result=auditarCatalogoSaida(originais)
  assert.equal(result.comAlgumCodigoSaida,2)
  assert.equal(result.entradaEmVenda,1)
  assert.equal(result.comPis49,2)
  assert.deepEqual(result.divergenciasCfop,[{sku:'035585131214',codigos:['2102','5102']}])
  assert.deepEqual(originais,snapshot)
})
