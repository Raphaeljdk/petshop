import {test} from 'node:test'
import assert from 'node:assert/strict'
import {envelopeSoapHomologacao,interpretarAutorizacaoHomologacao,
  montarConsultaHomologacao,montarRetornoHomologacao,montarLoteHomologacao
} from '../src/lib/sefaz-sp-nfe-homologacao'

const chave='35261157199062000191550020000000011123456789'
function resposta(protChave=chave,cStat='100'){
 return '<soap:Envelope><soap:Body><nfeResultMsg><retEnviNFe versao="4.00">'+
  '<tpAmb>2</tpAmb><cStat>104</cStat><xMotivo>Lote processado</xMotivo>'+
  '<protNFe><infProt><tpAmb>2</tpAmb><chNFe>'+protChave+'</chNFe>'+
  '<cStat>'+cStat+'</cStat><xMotivo>Autorizado</xMotivo>'+
  '<nProt>135260000000001</nProt></infProt></protNFe>'+
  '</retEnviNFe></nfeResultMsg></soap:Body></soap:Envelope>'
}
test('autorização em homologação exige protocolo correspondente e válido',()=>{
 const r=interpretarAutorizacaoHomologacao(resposta(),chave)
 assert.equal(r.ambiente,2)
 assert.equal(r.statusLote,104)
 assert.equal(r.protocolo?.chave,chave)
 assert.equal(r.autorizada,true)
})
test('chave divergente, resposta fora de homologação e SOAP fault são bloqueados',()=>{
 assert.throws(()=>interpretarAutorizacaoHomologacao(resposta(chave.slice(0,-1)+'0'),chave),/Chave/)
 assert.throws(()=>interpretarAutorizacaoHomologacao(resposta().replace('<tpAmb>2</tpAmb>','<tpAmb>1</tpAmb>'),chave),/homologação/)
 assert.throws(()=>interpretarAutorizacaoHomologacao('<soap:Fault/>',chave),/SOAP/)
})
test('status de protocolo rejeitado não equivale a autorização',()=>{
 const r=interpretarAutorizacaoHomologacao(resposta(chave,'204'),chave)
 assert.equal(r.autorizada,false)
})
test('consulta de recibo e protocolo impõem formatos, tpAmb 2 e SOAP 1.2',()=>{
 assert.match(montarConsultaHomologacao(chave),/<tpAmb>2<\/tpAmb>/)
 assert.match(montarRetornoHomologacao('135260000000001'),/<nRec>135260000000001<\/nRec>/)
 assert.throws(()=>montarRetornoHomologacao('2'),/15 dígitos/)
 assert.match(envelopeSoapHomologacao('consulta','<x/>'),/NFeConsultaProtocolo4/)
})
test('lote só aceita XML assinado marcado para tpAmb 2; não confirma assinatura por si só',()=>{
 assert.throws(()=>montarLoteHomologacao('<NFe><tpAmb>2</tpAmb></NFe>','1'),/assinatura/)
 assert.throws(()=>montarLoteHomologacao('<NFe><tpAmb>1</tpAmb><Signature\/></NFe>','1'),/homologação/)
 const lote=montarLoteHomologacao('<NFe><tpAmb>2</tpAmb><Signature/></NFe>','1')
 assert.match(lote,/<indSinc>1<\/indSinc>/)
})
