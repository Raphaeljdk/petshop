import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planejarCompartilhamentoFiscal, type ProdutoSkuFiscal } from '../src/lib/fiscal-sku-reuse'

const sku='035585131214'
const make=(id:string,extra:Partial<ProdutoSkuFiscal>={}):ProdutoSkuFiscal=>({
  id,nome:'KONG Puppy Medium',sku,zettaProCod:null,mlItemId:null,amazonAsin:null,
  ncm:null,cest:null,gtinFiscal:null,cfop:null,csosn:null,pisCst:null,cofinsCst:null,
  ...extra,
})
test('NCM já registrado em um anúncio pode preencher outro do mesmo GTIN sem tocar em impostos',()=>{
  const origem=make('a',{ncm:'40169990',cfop:'5102',csosn:'102',pisCst:'49',cofinsCst:'49'})
  const alvo=make('b',{nome:'Brinquedo Kong Puppy M Azul',cfop:'2102'})
  const snapshot=structuredClone([origem,alvo])
  const planos=planejarCompartilhamentoFiscal([origem,alvo])
  assert.equal(planos.length,1)
  assert.equal(planos[0].elegivel,true)
  assert.deepEqual(planos[0].atualizacoes,[{id:'b',campos:{ncm:'40169990'}}])
  assert.deepEqual(planos[0].conflitosTributarios,['cfop'])
  assert.deepEqual([origem,alvo],snapshot)
})
test('GTIN confirmado também é sugerido, nunca fabricado apenas por SKU',()=>{
  let g=planejarCompartilhamentoFiscal([make('a',{ncm:'40169990'}),make('b')])[0]
  assert.deepEqual(g.atualizacoes[0].campos,{ncm:'40169990'})
  g=planejarCompartilhamentoFiscal([make('a',{gtinFiscal:sku}),make('b')])[0]
  assert.deepEqual(g.atualizacoes[0].campos,{gtinFiscal:sku})
})
test('NCM conflitante bloqueia propagação de qualquer dado do SKU',()=>{
  const g=planejarCompartilhamentoFiscal([make('a',{ncm:'40169990'}),make('b',{ncm:'39269090'})])[0]
  assert.equal(g.elegivel,false)
  assert.equal(g.atualizacoes.length,0)
  assert.match(g.razoes.join(' '),/Divergência no ncm/)
})
test('GTIN diferente bloqueia, incluindo duas identidades na mesma etiqueta',()=>{
  const g=planejarCompartilhamentoFiscal([make('a',{gtinFiscal:sku}),make('b',{gtinFiscal:'035585402017'})])[0]
  assert.equal(g.elegivel,false)
  assert.match(g.razoes.join(' '),/GTIN/)
})
test('Não mistura kit e produto unitário ou IDs Zetta físicos distintos',()=>{
  const a=make('a',{ncm:'40169990',zettaProCod:101})
  const b=make('b',{nome:'Kit 2x KONG Puppy Medium',zettaProCod:102})
  const g=planejarCompartilhamentoFiscal([a,b])[0]
  assert.equal(g.elegivel,false)
  assert.match(g.razoes.join(' '),/Zetta/)
  assert.match(g.razoes.join(' '),/kit/)
})
test('SKU inválido não recebe reaproveitamento automático',()=>{
  const g=planejarCompartilhamentoFiscal([make('a',{sku:'CODINTERNAL123',ncm:'40169990'}),make('b',{sku:'CODINTERNAL123'})])[0]
  assert.equal(g.elegivel,false)
  assert.equal(g.atualizacoes.length,0)
})
test('Não substitui um valor existente ou um campo com texto inesperado',()=>{
  const g=planejarCompartilhamentoFiscal([make('a',{ncm:'40169990'}),make('b',{ncm:'   '})])[0]
  assert.equal(g.elegivel,true)
  assert.equal(g.atualizacoes.length,0)
})
test('Não cria links entre SKUs distintos ou anúncios isolados',()=>{
  const result=planejarCompartilhamentoFiscal([make('a'),make('b',{sku:'035585402017'}),make('c',{sku:null})])
  assert.deepEqual(result,[])
})
