import {test} from 'node:test'
import assert from 'node:assert/strict'
import {envelopeSoapHomologacao,interpretarAutorizacaoHomologacao,
  montarConsultaHomologacao,montarRetornoHomologacao,montarLoteHomologacao,
  classificarSituacaoHomologacao,podeRetransmitirHomologacao
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

test('cStat 217 após timeout é consulta sem localização, não rejeição definitiva da emissão',()=>{
 const xml='<soap:Envelope><soap:Body><retConsSitNFe><tpAmb>2</tpAmb><cStat>217</cStat>'+
  '<xMotivo>Rejeição: NF-e não consta na base de dados da SEFAZ</xMotivo>'+
  '</retConsSitNFe></soap:Body></soap:Envelope>'
 const r=interpretarAutorizacaoHomologacao(xml,chave)
 assert.equal(r.statusLote,217)
 assert.equal(classificarSituacaoHomologacao(r),'incerta')
})
test('reenvio de homologação exige mesma nota incerta, cStat 217, prazo e ausência de protocolo',()=>{
 const agora=Date.UTC(2026,10,17,2)
 const item={ambiente:2,status:'incerta',codigoSefaz:217,recibo:null,protocolo:null,
  enviadaEm:new Date(agora-180_000)}
 assert.equal(podeRetransmitirHomologacao(item,agora),true)
 assert.equal(podeRetransmitirHomologacao({...item,enviadaEm:new Date(agora-179_999)},agora),false)
 assert.equal(podeRetransmitirHomologacao({...item,ambiente:1},agora),false)
 assert.equal(podeRetransmitirHomologacao({...item,status:'autorizada'},agora),false)
 assert.equal(podeRetransmitirHomologacao({...item,codigoSefaz:null},agora),false)
 assert.equal(podeRetransmitirHomologacao({...item,recibo:'123'},agora),false)
 assert.equal(podeRetransmitirHomologacao({...item,protocolo:'123'},agora),false)
})
