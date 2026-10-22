import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escopoConsultaCompleto, regraFiscalSeAplica, selecionarRegraFiscal } from '../src/lib/fiscal-consulta-automatica'

const entrada={ncm:'95030099',cfop:'5102',origem:'0',ufDestino:'SP',indicadorIE:'9'}
const regra={id:'revisada',...entrada,csosn:'102',pisCst:'49',cofinsCst:'49',
  ativo:true,vigenteDesde:null,vigenteAte:null}

test('consulta apenas cenário completo: NCM, revenda SP, origem e não contribuinte',()=>{
  assert.equal(escopoConsultaCompleto(entrada),true)
  assert.equal(escopoConsultaCompleto({...entrada,ncm:'9503'}),false)
  assert.equal(escopoConsultaCompleto({...entrada,cfop:'6102'}),false)
  assert.equal(escopoConsultaCompleto({...entrada,ufDestino:'RJ'}),false)
  assert.equal(escopoConsultaCompleto({...entrada,indicadorIE:'1'}),false)
})
test('localiza regra revisada exata sem inventar campos e nem mutar dados',()=>{
  const snapshot=structuredClone(regra)
  const match=selecionarRegraFiscal([regra],entrada)
  assert.equal(match.status,'encontrada')
  assert.deepEqual(match.regra,regra)
  assert.deepEqual(regra,snapshot)
})
test('bloqueia regra de NCM similar com origem, CFOP ou destino distintos',()=>{
  assert.equal(regraFiscalSeAplica({...regra,ncm:'95030098'},entrada),false)
  assert.equal(regraFiscalSeAplica({...regra,origem:'1'},entrada),false)
  assert.equal(regraFiscalSeAplica({...regra,cfop:'5405'},entrada),false)
  assert.equal(regraFiscalSeAplica({...regra,ufDestino:'PR'},entrada),false)
  assert.equal(selecionarRegraFiscal([{...regra,cfop:'5405'}],entrada).status,'sem_regra')
})
test('regras inativas, futuras e expiradas não são aplicadas',()=>{
  const date=new Date('2026-10-22T10:00:00Z')
  assert.equal(regraFiscalSeAplica({...regra,ativo:false},entrada,date),false)
  assert.equal(regraFiscalSeAplica({...regra,vigenteDesde:'2027-01-01'},entrada,date),false)
  assert.equal(regraFiscalSeAplica({...regra,vigenteAte:'2026-01-01'},entrada,date),false)
})
test('nunca seleciona uma regra quando a consulta é ambígua',()=>{
  const match=selecionarRegraFiscal([regra,{...regra,id:'revisada2'}],entrada)
  assert.equal(match.status,'ambigua')
  assert.equal(match.regra,null)
})
test('não sugere códigos sem NCM completo',()=>{
  const match=selecionarRegraFiscal([regra],{...entrada,ncm:''})
  assert.equal(match.status,'escopo_incompleto')
  assert.equal(match.regra,null)
})
