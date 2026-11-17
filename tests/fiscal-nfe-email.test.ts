import {test} from 'node:test'
import assert from 'node:assert/strict'
import {nfeRealAutorizadaParaEmail,type NfeParaEmail} from '../src/lib/fiscal-nfe-email'

const chave='35261157199062000191550020000000011123456789'
const prot='135260000000001'
function nota():NfeParaEmail{
 return {modelo:'55',status:'autorizada',emissor:'matilha_prado',
  chaveAcesso:chave,protocolo:prot,
  xmlAutorizado:'<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">'+
   '<NFe><infNFe Id="NFe'+chave+'"><ide><tpAmb>1</tpAmb></ide></infNFe></NFe>'+
   '<protNFe><infProt><tpAmb>1</tpAmb><chNFe>'+chave+
   '</chNFe><cStat>100</cStat><nProt>'+prot+'</nProt></infProt></protNFe></nfeProc>'}
}
test('apenas NF-e real própria autorizada com protocolo e XML completo pode gerar e-mail',()=>{
 assert.equal(nfeRealAutorizadaParaEmail(nota()),true)
 assert.equal(nfeRealAutorizadaParaEmail({...nota(),emissor:'mercado_livre'}),false)
 assert.equal(nfeRealAutorizadaParaEmail({...nota(),status:'rejeitada'}),false)
 assert.equal(nfeRealAutorizadaParaEmail({...nota(),status:'pendente_confirmacao'}),false)
 assert.equal(nfeRealAutorizadaParaEmail({...nota(),modelo:'65'}),false)
 assert.equal(nfeRealAutorizadaParaEmail({...nota(),protocolo:null}),false)
})
test('nota de homologação e XML com protocolo divergente não podem ser enviados por e-mail',()=>{
 const base=nota()
 assert.equal(nfeRealAutorizadaParaEmail({...base,xmlAutorizado:base.xmlAutorizado?.replaceAll('<tpAmb>1</tpAmb>','<tpAmb>2</tpAmb>')||null}),false)
 assert.equal(nfeRealAutorizadaParaEmail({...base,xmlAutorizado:base.xmlAutorizado?.replace('<cStat>100</cStat>','<cStat>434</cStat>')||null}),false)
 assert.equal(nfeRealAutorizadaParaEmail({...base,xmlAutorizado:base.xmlAutorizado?.replace('<chNFe>'+chave+'</chNFe>','<chNFe>'+chave.slice(0,-1)+'0</chNFe>')||null}),false)
 assert.equal(nfeRealAutorizadaParaEmail({...base,xmlAutorizado:base.xmlAutorizado?.replace('<nProt>'+prot+'</nProt>','<nProt>135260000000002</nProt>')||null}),false)
 assert.equal(nfeRealAutorizadaParaEmail({...base,xmlAutorizado:null}),false)
})
