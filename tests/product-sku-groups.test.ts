import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agruparPorSku, agruparFiscalPorSku, codigoCompartilhado } from '../src/lib/product-sku-groups'
const code='035585131214'
const fields={ncm:null,gtinFiscal:null,cest:null,cfop:null,origem:null,cst:null,
  csosn:null,unidadeFiscal:null,pisCst:null,cofinsCst:null,
  ipiCst:null,ibsCbsCst:null,ibsCbsClassTrib:null}
const p=(id:string,nome:string,estoque:number,extras:Record<string,unknown>={})=>({
  id,sku:code,nome,estoque,zettaProCod:null,mlItemId:null,amazonAsin:null,
  ...fields,...extras,
})
test('Agrupa oito anuncios ML Amazon e Zetta do mesmo SKU sem alterar nenhum registro',()=>{
  const rows=[
    p('1','KONG PUPPY MEDIUM',2,{zettaProCod:121,ncm:'40169990'}),
    p('2','Brinquedo Kong Puppy Medium Rosa',1,{mlItemId:'MLB111',ncm:'40169990',csosn:'102'}),
    p('3','Brinquedo Kong Puppy Medium Azul',3,{mlItemId:'MLB222'}),
    p('4','KONG Puppy cores sortidas Medium',2,{amazonAsin:'B00Q2QK2R2'}),
    p('5','KONG Puppy Rosa M',0),p('6','KONG Puppy Medium Rosa',1),
    p('7','KONG Puppy Medium Rosa Rosa',1),p('8','KONG Puppy Medium Azul Azul',1),
  ]
  const snapshot=structuredClone(rows)
  const result=agruparFiscalPorSku(rows)
  assert.equal(result.length,1)
  assert.equal(result[0].anunciosVinculados,8)
  assert.equal(result[0].ncm,'40169990')
  assert.ok(result[0].camposParciais.includes('ncm'))
  assert.equal(result[0].anunciosOriginais.length,8)
  assert.deepEqual(rows,snapshot)
  const grouped=agruparPorSku(rows)
  assert.equal(grouped.length,1)
  assert.equal(grouped[0].estoquesDiferentes,true)
  assert.equal(grouped[0].principal.estoque,2)
})
test('Exibe conflito de CFOP sem escolher automaticamente o codigo',()=>{
 const rows=[p('1','KONG Puppy',2,{cfop:'5102'}),p('2','KONG Puppy Rosa',1,{cfop:'2102'})]
 const grupo=agruparFiscalPorSku(rows)[0]
 assert.equal(grupo.cfop,null)
 assert.deepEqual(grupo.camposDivergentes,['cfop'])
 assert.deepEqual(rows.map(p=>p.cfop),['5102','2102'])
})
test('Nao agrupa variantes com SKUs diferentes e nao inventa SKU quando faltante',()=>{
 const rows=[p('1','KONG Puppy Medium',1),{...p('2','KONG Puppy Large',4),sku:'035585131115'},
  {...p('3','KONG Puppy Medium',1),sku:null},{...p('4','KONG Puppy Medium',1),sku:null}]
 assert.equal(agruparPorSku(rows).length,4)
})
test('Mantem GTIN e NCM divergentes pendentes, sem apagar originais',()=>{
 const rows=[p('1','Brinquedo',2,{gtinFiscal:'035585131214',ncm:'40169990'}),
 p('2','Brinquedo',1,{gtinFiscal:'035585131115',ncm:'39269090'})]
 const grupo=agruparFiscalPorSku(rows)[0]
 assert.equal(grupo.ncm,null)
 assert.equal(grupo.gtinFiscal,null)
 assert.deepEqual(grupo.camposDivergentes,['ncm','gtinFiscal'])
 assert.equal(rows[0].ncm,'40169990')
})
test('Nao identifica anuncios marketplace gerados como SKU canonico',()=>{
 assert.equal(codigoCompartilhado('MLB123456789'),null)
 assert.equal(codigoCompartilhado('B00Q2QK2R2'),null)
 assert.equal(codigoCompartilhado(code),code)
})
