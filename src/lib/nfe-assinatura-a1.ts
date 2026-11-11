import forge from 'node-forge'
import { createPublicKey, X509Certificate } from 'node:crypto'
import { SignedXml } from 'xml-crypto'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'

const NFE_NS='http://www.portalfiscal.inf.br/nfe'
const DS_NS='http://www.w3.org/2000/09/xmldsig#'
const C14N='http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
const SIG_RSA='http://www.w3.org/2000/09/xmldsig#rsa-sha1'
const DIGEST_SHA1='http://www.w3.org/2000/09/xmldsig#sha1'
const ENVELOPED='http://www.w3.org/2000/09/xmldsig#enveloped-signature'
const CHAVE=/^NFe\d{44}$/

export class AssinaturaNfeError extends Error {
 constructor(mensagem:string){super(mensagem);this.name='AssinaturaNfeError'}
}
export type ChavesA1={privateKeyPem:string;certificadoPem:string;cnpj:string;venceEm:string}
const digitos=(valor:string)=>valor.replace(/\D/g,'')

/**
 * Lê o certificado A1 protegido SOMENTE no processo servidor. Não registra PEM
 * ou senha. Exige um par chave/certificado válido e CNPJ verificável no CN.
 */
export function extrairCertificadoA1(pfx:Buffer,senha:string,cnpjEmitente:string):ChavesA1{
 const cnpj=digitos(cnpjEmitente)
 if(!/^\d{14}$/.test(cnpj))throw new AssinaturaNfeError('CNPJ do emitente inválido.')
 if(pfx.length<300||pfx.length>150_000||!senha)throw new AssinaturaNfeError('A1 indisponível.')
 try{
  const asn1=forge.asn1.fromDer(forge.util.createBuffer(pfx.toString('binary')))
  const p12=forge.pkcs12.pkcs12FromAsn1(asn1,false,senha)
  const bagsKey=[
   ...(p12.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[]),
   ...(p12.getBags({bagType:forge.pki.oids.keyBag})[forge.pki.oids.keyBag]||[]),
  ]
  const key=bagsKey.find(b=>b.key)?.key
  if(!key)throw new AssinaturaNfeError('Certificado A1 sem chave privada.')
  const privateKeyPem=forge.pki.privateKeyToPem(key)
  const chavePublica=createPublicKey(privateKeyPem).export({format:'der',type:'spki'}) as Buffer
  const certificados=p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[]
  for(const bag of certificados){
   if(!bag.cert)continue
   const certificadoPem=forge.pki.certificateToPem(bag.cert)
   const cert=new X509Certificate(certificadoPem)
   const derPublico=cert.publicKey.export({format:'der',type:'spki'}) as Buffer
   if(!derPublico.equals(chavePublica))continue
   const cn=bag.cert.subject.getField('CN')?.value||''
   if(!digitos(cn).includes(cnpj) && !cert.subject.includes(cnpj))
    throw new AssinaturaNfeError('O CNPJ do certificado A1 não coincide com o emitente.')
   const agora=Date.now()
   if(agora<Date.parse(cert.validFrom)||agora>Date.parse(cert.validTo))
    throw new AssinaturaNfeError('Certificado A1 fora da validade.')
   return {privateKeyPem,certificadoPem,cnpj,venceEm:cert.validTo}
  }
  throw new AssinaturaNfeError('Nenhum certificado corresponde à chave privada A1.')
 }catch(err){
  if(err instanceof AssinaturaNfeError)throw err
  throw new AssinaturaNfeError('Não foi possível abrir ou validar o certificado A1.')
 }
}
export function validarCnpjA1(pfx:Buffer,senha:string,cnpj:string){
 const certificado=extrairCertificadoA1(pfx,senha,cnpj)
 return {corresponde:true,venceEm:certificado.venceEm}
}
/**
 * Assina SOMENTE infNFe e verifica a assinatura novamente (XMLDSig enveloped).
 * Não interpreta uma assinatura qualquer como autorização da SEFAZ.
 */
export function assinarXmlNfeHomologacao(xmlRascunho:string,chaves:ChavesA1){
 if(xmlRascunho.length>450_000||/<\!DOCTYPE|<\!ENTITY/i.test(xmlRascunho))
  throw new AssinaturaNfeError('XML inválido para assinatura.')
 const documento=new DOMParser({onError:()=>{throw new AssinaturaNfeError('XML malformado.')}})
  .parseFromString(xmlRascunho,'text/xml')
 const raizes=documento.getElementsByTagNameNS(NFE_NS,'NFe')
 const itens=documento.getElementsByTagNameNS(NFE_NS,'infNFe')
 if(raizes.length!==1||itens.length!==1||raizes[0]!==documento.documentElement||
    itens[0].parentNode!==raizes[0])
  throw new AssinaturaNfeError('Documento não é NF-e 55 com infNFe única.')
 const inf=itens[0], id=inf.getAttribute('Id')||''
 if(!CHAVE.test(id)||inf.getAttribute('versao')!=='4.00')
  throw new AssinaturaNfeError('Id da NF-e ou versão inválidos.')
 const ambiente=inf.getElementsByTagNameNS(NFE_NS,'tpAmb')
 if(ambiente.length!==1||ambiente[0].textContent!=='2')
  throw new AssinaturaNfeError('Somente XML de homologação pode ser assinado.')
 if(documento.getElementsByTagNameNS(DS_NS,'Signature').length)
  throw new AssinaturaNfeError('XML já contém assinatura.')
 const sign=new SignedXml({
  privateKey:chaves.privateKeyPem,publicCert:chaves.certificadoPem,
  signatureAlgorithm:SIG_RSA,canonicalizationAlgorithm:C14N,
 })
 sign.addReference({
  xpath:"//*[local-name(.)='infNFe' and namespace-uri(.)='"+NFE_NS+"']",
  transforms:[ENVELOPED,C14N],
  digestAlgorithm:DIGEST_SHA1,
 })
 sign.computeSignature(xmlRascunho,{
  location:{reference:"//*[local-name(.)='infNFe' and namespace-uri(.)='"+NFE_NS+"']",action:'after'},
 })
 const assinado=sign.getSignedXml()
 const verDoc=new DOMParser().parseFromString(assinado,'text/xml')
 const assinaturas=verDoc.getElementsByTagNameNS(DS_NS,'Signature')
 if(assinaturas.length!==1)throw new AssinaturaNfeError('Assinatura ausente ou duplicada.')
 const ref=assinaturas[0].getElementsByTagNameNS(DS_NS,'Reference')
 if(ref.length!==1||ref[0].getAttribute('URI')!=='#'+id)
  throw new AssinaturaNfeError('Referência da assinatura não confere.')
 const verificar=new SignedXml({publicCert:chaves.certificadoPem,getCertFromKeyInfo:()=>null})
 verificar.loadSignature(new XMLSerializer().serializeToString(assinaturas[0]))
 if(!verificar.checkSignature(assinado)||verificar.getSignedReferences().length!==1)
  throw new AssinaturaNfeError('Verificação XMLDSig falhou.')
 const conteudo=verificar.getSignedReferences()[0].toString()
 if(!conteudo.includes('Id="'+id+'"'))
  throw new AssinaturaNfeError('Conteúdo assinado não corresponde à chave da NF-e.')
 return {xmlAssinado:assinado,chave:id.slice(3),assinaturaVerificada:true as const}
}

/** Verifica novamente o XML persistido ANTES de transmiti-lo. Protege contra
 * alterações na base entre preparo e autorização, mantendo XMLDSig e chave intactos. */
export function validarAssinaturaNfeHomologacao(xml:string,certificadoPem:string,chave:string){
 if(!/^\d{44}$/.test(chave)||xml.length>500_000||/<!DOCTYPE|<!ENTITY/i.test(xml))
  throw new AssinaturaNfeError('XML ou chave inválidos para conferência.')
 const doc=new DOMParser({onError:()=>{throw new AssinaturaNfeError('XML malformado.')}})
  .parseFromString(xml,'text/xml')
 const raiz=doc.getElementsByTagNameNS(NFE_NS,'NFe')
 const infos=doc.getElementsByTagNameNS(NFE_NS,'infNFe')
 const assinaturas=doc.getElementsByTagNameNS(DS_NS,'Signature')
 if(raiz.length!==1||raiz[0]!==doc.documentElement||infos.length!==1||
  infos[0].parentNode!==raiz[0]||infos[0].getAttribute('Id')!=='NFe'+chave||
  assinaturas.length!==1||assinaturas[0].parentNode!==raiz[0])
  throw new AssinaturaNfeError('Estrutura XML ou chave de acesso divergente.')
 const ambientes=infos[0].getElementsByTagNameNS(NFE_NS,'tpAmb')
 if(ambientes.length!==1||ambientes[0].textContent!=='2')
  throw new AssinaturaNfeError('Só é permitida NF-e de homologação.')
 const refs=assinaturas[0].getElementsByTagNameNS(DS_NS,'Reference')
 if(refs.length!==1||refs[0].getAttribute('URI')!=='#NFe'+chave)
  throw new AssinaturaNfeError('Referência da assinatura difere da NF-e.')
 const assinatura=new SignedXml({publicCert:certificadoPem,getCertFromKeyInfo:()=>null})
 assinatura.loadSignature(new XMLSerializer().serializeToString(assinaturas[0]))
 if(!assinatura.checkSignature(xml)||assinatura.getSignedReferences().length!==1)
  throw new AssinaturaNfeError('Verificação criptográfica de XMLDSig inválida.')
 return {assinaturaValida:true as const,chave}
}
