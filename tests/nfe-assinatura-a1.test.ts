import {test} from 'node:test'
import assert from 'node:assert/strict'
import forge from 'node-forge'
import {extrairCertificadoA1,assinarXmlNfeHomologacao} from '../src/lib/nfe-assinatura-a1'

const CNPJ='57199062000191'
const CHAVE='35261157199062000191550020000000011123456789'
function certificadoSintetico(){
 const keys=forge.pki.rsa.generateKeyPair(1024)
 const cert=forge.pki.createCertificate()
 cert.publicKey=keys.publicKey
 cert.serialNumber='01'
 cert.validity.notBefore=new Date('2025-01-01T00:00:00Z')
 cert.validity.notAfter=new Date('2030-01-01T00:00:00Z')
 const attrs=[{name:'commonName',value:'EMPRESA FICTICIA:'+CNPJ}]
 cert.setSubject(attrs)
 cert.setIssuer(attrs)
 cert.sign(keys.privateKey)
 const p12=forge.pkcs12.toPkcs12Asn1(keys.privateKey,[cert],'senha-teste',{
  generateLocalKeyId:true,algorithm:'3des',
 })
 return Buffer.from(forge.asn1.toDer(p12).getBytes(),'binary')
}
test('extrai chave A1 sintética e assina infNFe; verifica localmente sem transmissão',()=>{
 const cred=extrairCertificadoA1(certificadoSintetico(),'senha-teste',CNPJ)
 assert.equal(cred.cnpj,CNPJ)
 const xml='<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe versao="4.00" Id="NFe'+CHAVE+
  '"><ide><tpAmb>2</tpAmb></ide></infNFe></NFe>'
 const result=assinarXmlNfeHomologacao(xml,cred)
 assert.equal(result.chave,CHAVE)
 assert.equal(result.assinaturaVerificada,true)
 assert.match(result.xmlAssinado,/<Signature/)
 assert.match(result.xmlAssinado,/<X509Certificate>/)
 assert.doesNotMatch(result.xmlAssinado,/PRIVATE KEY|senha-teste/)
})
test('rejeita outro CNPJ e A1 com senha errada',()=>{
 const pfx=certificadoSintetico()
 assert.throws(()=>extrairCertificadoA1(pfx,'senha-teste','00000000000191'),/CNPJ/)
 assert.throws(()=>extrairCertificadoA1(pfx,'errada',CNPJ),/A1/)
})
test('bloqueia assinatura fora de homologação',()=>{
 const cred=extrairCertificadoA1(certificadoSintetico(),'senha-teste',CNPJ)
 const xml='<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe versao="4.00" Id="NFe'+CHAVE+
  '"><ide><tpAmb>1</tpAmb></ide></infNFe></NFe>'
 assert.throws(()=>assinarXmlNfeHomologacao(xml,cred),/homologação/)
})
