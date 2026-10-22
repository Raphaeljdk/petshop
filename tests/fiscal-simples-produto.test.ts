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
