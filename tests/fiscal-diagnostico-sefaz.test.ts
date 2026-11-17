import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mapearConsultaSefaz} from '../src/lib/fiscal-diagnostico-sefaz'

test('serviço em operação mostra cStat 107 e não cria falso código NAO_INFORMADO',()=>{
 const r=mapearConsultaSefaz({ok:true,codigo:107,
  aviso:'A1 aceito e serviço operacional; nenhuma NF-e emitida.'},true)
 assert.equal(r.codigoSefaz,107)
 assert.equal(r.codigoTecnico,null)
 assert.equal(r.categoria,'consulta')
 assert.equal(r.ok,true)
 assert.match(r.mensagem,/nenhuma NF-e emitida/)
})
test('falha TLS mantém categoria e código técnico real e não confunde com cStat',()=>{
 const r=mapearConsultaSefaz({error:'Falha TLS',categoria:'certificado-tls',
  codigoTecnico:'EPROTO'},false)
 assert.equal(r.codigoSefaz,null)
 assert.equal(r.codigoTecnico,'EPROTO')
 assert.equal(r.categoria,'certificado-tls')
 assert.equal(r.ok,false)
})
test('ausência de código técnico não é erro por si só',()=>{
 const r=mapearConsultaSefaz({ok:true,codigo:107},true)
 assert.equal(r.codigoTecnico,null)
 assert.equal(r.codigoSefaz,107)
 assert.equal(r.ok,true)
})
