import { test } from 'node:test'
import assert from 'node:assert/strict'
import {testarSchemaAutoContido, validarXmlNfeXsdHomologacao} from '../src/lib/nfe-validacao-xsd'
import {gerarRascunhoNfe55} from '../src/lib/nfe-xml-modelo55'
import {assinarXmlNfeHomologacao} from '../src/lib/nfe-assinatura-a1'
import forge from 'node-forge'

test('XSD real valida XML em teste mínimo',()=>{
 const xsd='<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">'+
  '<xs:element name="nota"><xs:complexType><xs:sequence>'+
  '<xs:element name="numero" type="xs:integer"/>'+
  '</xs:sequence></xs:complexType></xs:element></xs:schema>'
 assert.equal(testarSchemaAutoContido('<nota><numero>55</numero></nota>',xsd),true)
 assert.throws(()=>testarSchemaAutoContido('<nota><numero>abc</numero></nota>',xsd))
})
test('pacote 010g rejeita NF-e sem campos obrigatórios',()=>{
 assert.throws(()=>validarXmlNfeXsdHomologacao(
  '<NFe xmlns="http://www.portalfiscal.inf.br/nfe"/>'
 ),/XSD|pacote/)
})

test('assinatura A1 sintética e XML 55 passam pelo XSD do pacote 010g',()=>{
 const chaves=forge.pki.rsa.generateKeyPair(1024)
 const certificado=forge.pki.createCertificate()
 certificado.publicKey=chaves.publicKey
 certificado.serialNumber='01'
 certificado.validity.notBefore=new Date('2025-01-01')
 certificado.validity.notAfter=new Date('2030-01-01')
 const attrs=[{name:'commonName',value:'Emissor Ficticio:57199062000191'}]
 certificado.setSubject(attrs);certificado.setIssuer(attrs);certificado.sign(chaves.privateKey)
 const empresa={
  cnpj:'57199062000191',razaoSocial:'Empresa teste',nomeFantasia:null,
  inscricaoEstadual:'150787370115',regimeTributario:'1',
  logradouro:'Rua Alfa',numeroEndereco:'10',bairro:'Centro',cidade:'Sao Paulo',
  codigoMunicipio:'3550308',uf:'SP',cep:'01001000',serieNfe:2,
 }
 const venda={id:'test',status:'concluida',canal:'site',total:10,subtotalProdutos:10,
  valorFrete:0,descontoCupom:0,itens:[{
   produtoId:'bola',quantidade:1,precoUnit:10,
   produto:{nome:'Bola laranja teste',sku:'7899669611657',ncm:'39269090',cest:null,
    cfop:'5102',origem:'0',csosn:'102',unidadeFiscal:'UN'}
  }]}
 const input={
  numero:1,codigoNumerico:'12345678',naturezaOperacao:'Venda de mercadoria',
  destinatario:{nome:'Consumidor teste',documento:'12345678909',indicadorIE:'9' as const,
   endereco:{logradouro:'Rua Beta',numero:'20',bairro:'Centro',municipio:'Sao Paulo',
    codigoMunicipio:'3550308',uf:'SP',cep:'01002000'}},
  consumidorFinal:'1' as const,pagamento:'17' as const,modalidadeFrete:'9' as const,
  itens:[{produtoId:'bola',gtin:'7899669611657',pisCst:'49',cofinsCst:'49',
   pis:{base:0,aliquota:0,valor:0},cofins:{base:0,aliquota:0,valor:0}}],
 }
 const rascunho=gerarRascunhoNfe55(venda,empresa,input,new Date('2026-11-11T16:30:00Z'))
 const assinado=assinarXmlNfeHomologacao(rascunho.xml,{
  privateKeyPem:forge.pki.privateKeyToPem(chaves.privateKey),
  certificadoPem:forge.pki.certificateToPem(certificado),
  cnpj:'57199062000191',venceEm:'2030-01-01',
 })
 const result=validarXmlNfeXsdHomologacao(assinado.xmlAssinado)
 assert.equal(result.valido,true)
 assert.equal(result.esquema,'010g v1.03')
})
