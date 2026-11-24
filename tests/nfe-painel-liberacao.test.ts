import {test} from 'node:test'
import assert from 'node:assert/strict'
import {comporPainelLiberacao} from '../src/lib/nfe-painel-liberacao'
test('autoriza somente homologação com protocolo e XML registrados, sem liberar produção',()=>{
 const painel=comporPainelLiberacao({notas:[
  {modelo:'55',serie:1,numero:1204,emissor:'mercado_livre',status:'autorizada'},
  {modelo:'55',serie:2,numero:5,emissor:'matilha_prado',status:'rascunho'},
 ],testes:[
  {serie:2,numero:1,status:'incerta',codigoSefaz:217,protocolo:null,temXml:false},
  {serie:2,numero:4,status:'autorizada',codigoSefaz:100,protocolo:'135260000000001',temXml:true},
 ],emissaoRealImplementada:false,emailAutomatico:false,regrasAtivas:1})
 assert.deepEqual(painel.autorizadasHomologacao,[{serie:2,numero:4,codigoSefaz:100}])
 assert.equal(painel.nota1.precisaConsulta,true)
 assert.equal(painel.serieProducaoConfirmada,false)
 assert.equal(painel.emissaoRealHabilitada,false)
 assert.equal(painel.seriesConhecidas[0].maiorConhecido,1204)
 assert.ok(painel.pendencias.some(x=>x.includes('TODOS os emissores')))
})
test('não usa rascunho ou sem protocolo como autorização',()=>{
 const painel=comporPainelLiberacao({notas:[],testes:[
  {serie:2,numero:4,status:'autorizada',codigoSefaz:100,protocolo:null,temXml:true},
 ],emissaoRealImplementada:false,emailAutomatico:true,regrasAtivas:0})
 assert.equal(painel.autorizadasHomologacao.length,0)
 assert.equal(painel.emissaoRealHabilitada,false)
})
