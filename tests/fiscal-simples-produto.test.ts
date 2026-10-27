import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validarCamposFiscaisSimples,
  pendenciasClassificacaoSimples,
  CSOSN_SIMPLES,
} from '../src/lib/fiscal-simples-produto'

test('Simples Nacional: reconhece os CSOSN oficiais, inclusive substituição tributária', () => {
  assert.deepEqual(CSOSN_SIMPLES, ['101','102','103','201','202','203','300','400','500','900'])
  for (const csosn of CSOSN_SIMPLES)
    assert.deepEqual(validarCamposFiscaisSimples({csosn}), [])
  assert.match(validarCamposFiscaisSimples({csosn:'060'}).join(' '), /CSOSN/)
})
test('não presume CSTs, alíquotas nem preenche campos vazios', () => {
  const produto = {ncm:'',cfop:'',csosn:'',pisCst:'',cofinsCst:'',gtinFiscal:''}
  const antes = structuredClone(produto)
  assert.deepEqual(validarCamposFiscaisSimples(produto), [])
  assert.ok(pendenciasClassificacaoSimples(produto).length >= 5)
  assert.deepEqual(produto, antes)
})
test('permite classificação revisada no futuro sem ativar IBS/CBS automaticamente', () => {
  const p = {ncm:'95030099',cest:null,cfop:'5102',origem:'0',csosn:'102',
    unidadeFiscal:'UN',gtinFiscal:'SEM GTIN',pisCst:'49',cofinsCst:'49',ipiCst:null,
    ibsCbsCst:null,ibsCbsClassTrib:null}
  assert.deepEqual(validarCamposFiscaisSimples(p), [])
  assert.deepEqual(pendenciasClassificacaoSimples(p), [])
})
test('exige CST IBS/CBS e cClassTrib em conjunto, sem inventá-los', () => {
  assert.ok(validarCamposFiscaisSimples({ibsCbsCst:'000'}).length > 0)
  assert.ok(validarCamposFiscaisSimples({ibsCbsClassTrib:'000001'}).length > 0)
  assert.deepEqual(validarCamposFiscaisSimples({ibsCbsCst:'000',ibsCbsClassTrib:'000001'}), [])
  assert.ok(validarCamposFiscaisSimples({ibsCbsCst:'00',ibsCbsClassTrib:'abc'}).length >= 2)
})
test('trata ICMS-ST como pendência de cálculo, não zero presumido', () => {
  const p = {ncm:'95030099',cfop:'5405',origem:'0',csosn:'500',gtinFiscal:'SEM GTIN',
    unidadeFiscal:'UN',pisCst:'49',cofinsCst:'49'}
  assert.match(pendenciasClassificacaoSimples(p).join(' '), /ICMS-ST/)
})
test('rejeita códigos malformados e não altera catálogo existente', () => {
  const invalidos = {ncm:'12',cest:'123',cfop:'510',origem:'9',gtinFiscal:'123',
    pisCst:'30',cofinsCst:'30',ipiCst:'30'}
  const copia = structuredClone(invalidos)
  assert.ok(validarCamposFiscaisSimples(invalidos).length >= 7)
  assert.deepEqual(invalidos,copia)
})


test('auditoria de CFOP identifica entradas e códigos especiais sem alterar valores', async () => {
  const { auditarCatalogoSaida } = await import('../src/lib/fiscal-auditoria-saida')
  const registros = [
    {id:'a',sku:'035585131214',nome:'KONG',ncm:'40169990',cfop:'5102',csosn:'102',pisCst:'49',cofinsCst:'49'},
    {id:'b',sku:'035585131214',nome:'KONG Rosa',ncm:'40169990',cfop:'2102',csosn:'102',pisCst:'49',cofinsCst:'49'},
    {id:'c',sku:'7899669611688',nome:'Jambo',ncm:'39269090',cfop:'5109',csosn:'102',pisCst:'49',cofinsCst:'49'},
  ]
  const antes=structuredClone(registros)
  const r=auditarCatalogoSaida(registros)
  assert.equal(r.entradaEmVenda,1)
  assert.equal(r.especiaisRevisar,1)
  assert.equal(r.comPis49,3)
  assert.deepEqual(r.divergenciasCfop,[{sku:'035585131214',codigos:['2102','5102']}])
  assert.deepEqual(registros,antes)
})
