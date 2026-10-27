import { X509Certificate, createPrivateKey, createPublicKey } from 'node:crypto'
import { DOMParser } from '@xmldom/xmldom'
import { SignedXml } from 'xml-crypto'
import forge from 'node-forge'
import { lerA1DeVariaveis } from '../sefaz-sp-nfe'

const NS='http://www.portalfiscal.inf.br/nfe'
const DS='http://www.w3.org/2000/09/xmldsig#'
const C14N='http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
function documento(xml:string) {
  if(Buffer.byteLength(xml)>512000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error('XML não permitido.')
  const doc=new DOMParser({onError:()=>{throw Error('XML inválido.')}}).parseFromString(xml,'application/xml')
  const root=doc.documentElement
  const infos=doc.getElementsByTagNameNS(NS,'infNFe')
  if(!root||root.localName!=='NFe'||root.namespaceURI!==NS||infos.length!==1||infos[0].parentNode!==root)
    throw Error('Exigida uma única NF-e modelo 55.')
  const info=infos[0]
  const id=info.getAttribute('Id')||''
  if(!/^NFe35[0-9]{42}$/.test(id)||info.getAttribute('versao')!=='4.00') throw Error('Identificação NF-e inválida.')
  const unico=(nome:string)=>{
    const tags=info.getElementsByTagNameNS(NS,nome)
    if(tags.length!==1)throw Error('Campo fiscal ausente ou duplicado.')
    return tags[0].textContent
  }
  if(unico('tpAmb')!=='2'||unico('mod')!=='55'||unico('cUF')!=='35')
    throw Error('Assinatura restrita a homologação SP, modelo 55.')
  const emit=info.getElementsByTagNameNS(NS,'emit')
  const cnpj=emit.length===1?emit[0].getElementsByTagNameNS(NS,'CNPJ')[0]?.textContent:null
  if(!cnpj||cnpj!==id.slice(9,23)) throw Error('CNPJ divergente da chave.')
  return {doc,info,id,cnpj}
}

/** Verifica com certificado fixado pelo servidor; nunca confia no KeyInfo recebido. */
export function verificarAssinatura(xml:string, certificadoPem:string) {
  try {
    const {doc,id}=documento(xml)
    const signatures=doc.getElementsByTagNameNS(DS,'Signature')
    if(signatures.length!==1||signatures[0].parentNode!==doc.documentElement)return false
    const refs=signatures[0].getElementsByTagNameNS(DS,'Reference')
    if(refs.length!==1||refs[0].getAttribute('URI')!=='#'+id)return false
    const verifier=new SignedXml({publicCert:certificadoPem,getCertFromKeyInfo:()=>null})
    verifier.loadSignature(signatures[0].toString())
    if(!verifier.checkSignature(xml))return false
    const authenticated=verifier.getSignedReferences()
    return authenticated.length===1 && authenticated[0].includes('Id="'+id+'"')
  } catch {return false}
}

/** Primitiva criptográfica. Validação XSD, aprovação fiscal e cadeia A1 são gates separados. */
export function assinarComMaterialServidor(xml:string, chavePem:string, certificadoPem:string, agora=new Date()) {
  const {doc,info}=documento(xml)
  if(doc.getElementsByTagNameNS(DS,'Signature').length)throw Error('XML já assinado.')
  try {
    const cert=new X509Certificate(certificadoPem)
    if(agora.getTime()<Date.parse(cert.validFrom)||agora.getTime()>Date.parse(cert.validTo))throw Error()
    const key=createPrivateKey(chavePem)
    if(key.asymmetricKeyType!=='rsa'||(key.asymmetricKeyDetails?.modulusLength||0)<2048)throw Error()
    if(!createPublicKey(key).export({type:'spki',format:'der'}).equals(cert.publicKey.export({type:'spki',format:'der'})))throw Error()
    const signer=new SignedXml({privateKey:chavePem,publicCert:certificadoPem,
      canonicalizationAlgorithm:C14N,signatureAlgorithm:DS+'rsa-sha1'})
    signer.addReference({xpath:"/*[local-name()='NFe']/*[local-name()='infNFe']",
      transforms:[DS+'enveloped-signature',C14N],digestAlgorithm:DS+'sha1'})
    signer.computeSignature(xml,{location:{reference:"/*[local-name()='NFe']/*[local-name()='infNFe']",action:'after'}})
    const assinado=signer.getSignedXml()
    if(!verificarAssinatura(assinado,certificadoPem))throw Error()
    return {xml:assinado,id:info.getAttribute('Id')!,certificadoSha256:cert.fingerprint256}
  } catch {throw Error('Não foi possível assinar com material válido do certificado A1.')}
}

/** Não retorna chave privada; material PKCS#12 permanece exclusivamente em memória no servidor. */
export function assinarComA1Configurado(xml:string) {
  const {cnpj}=documento(xml)
  const cred=lerA1DeVariaveis({SEFAZ_NFE_A1_PFX_BASE64:process.env.SEFAZ_NFE_A1_PFX_BASE64,SEFAZ_NFE_A1_SENHA:process.env.SEFAZ_NFE_A1_SENHA})
  try {
    const p12=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(cred.pfx.toString('binary')),cred.passphrase)
    const keys=p12.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[]
    const certs=p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[]
    if(keys.length!==1||!keys[0].key)throw Error()
    const key=keys[0].key
    const cert=certs.map(b=>b.cert).find(c=>c && 'n' in c.publicKey && c.publicKey.n.equals(key.n))
    if(!cert)throw Error()
    // Identificação ICP-Brasil otherName, OID 2.16.76.1.3.3 (CNPJ).
    const san=cert.getExtension('subjectAltName') as {value?:string}|null
    const matches:string[]=[]
    const walk=(node:forge.asn1.Asn1)=>{
      if(!Array.isArray(node.value))return
      const first=node.value[0]
      if(first?.type===forge.asn1.Type.OID&&typeof first.value==='string'&&forge.asn1.derToOid(first.value)==='2.16.76.1.3.3'){
        const values=(n:forge.asn1.Asn1):string[]=>typeof n.value==='string'?[n.value]:n.value.flatMap(values)
        matches.push(...node.value.slice(1).flatMap(values).filter(v=>/^\d{14}$/.test(v)))
      }
      node.value.forEach(walk)
    }
    if(san?.value)walk(forge.asn1.fromDer(san.value))
    if(matches.length!==1||matches[0]!==cnpj)throw Error()
    return assinarComMaterialServidor(xml,forge.pki.privateKeyToPem(key),forge.pki.certificateToPem(cert))
  } catch {throw Error('A1 indisponível, inválido ou sem vínculo confirmado com o CNPJ emitente.')}
  finally {cred.pfx.fill(0)}
}
