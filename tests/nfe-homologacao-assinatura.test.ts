import {test} from 'node:test'
import assert from 'node:assert/strict'
import forge from 'node-forge'
import {assinarComMaterialServidor,verificarAssinatura} from '../src/lib/nfe-homologacao/assinatura'

const keys=forge.pki.rsa.generateKeyPair(2048)
const cert=forge.pki.createCertificate()
cert.publicKey=keys.publicKey
cert.serialNumber='01'
cert.validity.notBefore=new Date('2026-01-01T00:00:00Z')
cert.validity.notAfter=new Date('2027-01-01T00:00:00Z')
cert.setSubject([{name:'commonName',value:'TESTE UNITARIO SEM VALIDADE FISCAL'}])
cert.setIssuer(cert.subject.attributes)
cert.sign(keys.privateKey,forge.md.sha256.create())
const pem=forge.pki.certificateToPem(cert)
const key=forge.pki.privateKeyToPem(keys.privateKey)
const agora=new Date('2026-10-27T12:00:00Z')
const xml='<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe versao="4.00" Id="NFe35261012345678000195550010000000011000000010"><ide><cUF>35</cUF><mod>55</mod><tpAmb>2</tpAmb></ide><emit><CNPJ>12345678000195</CNPJ></emit></infNFe></NFe>'
test('assina e verifica infNFe com certificado efêmero, sem acesso ao A1 real',()=>{
 const r=assinarComMaterialServidor(xml,key,pem,agora)
 assert.ok(verificarAssinatura(r.xml,pem))
 assert.ok(!verificarAssinatura(r.xml.replace('<mod>55','<mod>65'),pem))
 assert.ok(!verificarAssinatura(r.xml.replace('12345678000195</CNPJ>','99999999000199</CNPJ>'),pem))
 assert.throws(()=>assinarComMaterialServidor(r.xml,key,pem,agora))
})
test('bloqueia produção, certificado vencido, DTD e documento duplicado',()=>{
 assert.throws(()=>assinarComMaterialServidor(xml.replace('<tpAmb>2','<tpAmb>1'),key,pem,agora))
 assert.throws(()=>assinarComMaterialServidor(xml,key,pem,new Date('2028-01-01')))
 assert.throws(()=>assinarComMaterialServidor('<!DOCTYPE NFe>'+xml,key,pem,agora))
 assert.throws(()=>assinarComMaterialServidor(xml.replace('</NFe>',xml.slice(xml.indexOf('<infNFe'),xml.indexOf('</NFe>'))+'</NFe>'),key,pem,agora))
})
