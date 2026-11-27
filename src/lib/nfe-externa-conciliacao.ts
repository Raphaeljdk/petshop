import { DOMParser, XMLSerializer, type Element } from '@xmldom/xmldom'
import { X509Certificate } from 'node:crypto'
import { interpretarChaveNfe } from './fiscal-chave'
import { verificarNfeAssinada } from './nfe-assinatura-a1'
import { validarDocumentoXsd } from './nfe-validacao-xsd'
import { exigir, NFE_NS, interpretarRetornoReal } from './nfe-real-protocolo'

const DS='http://www.w3.org/2000/09/xmldsig#'
function unico(e:Element,n:string,ns=NFE_NS){
 const itens=Array.from(e.childNodes).filter((x):x is Element=>x.nodeType===1&&(x as Element).namespaceURI===ns&&(x as Element).localName===n)
 exigir(itens.length===1,'Estrutura fiscal inválida: '+n)
 return itens[0]
}
const valor=(e:Element,n:string)=>unico(e,n).textContent?.trim()??''
export const normalizarSkuNfe=(s:string)=>/^\d{8,14}$/.test(s)?s.replace(/^0+(?=\d)/,''):s
const centavos=(s:string)=>{exigir(/^\d{1,13}\.\d{2}$/.test(s),'Total fiscal inválido.');const v=Math.round(Number(s)*100);exigir(Number.isSafeInteger(v),'Total fiscal inválido.');return v}
/** O protocolo no arquivo não substitui consulta autenticada à SEFAZ. */
export function lerNfeExterna(xml:string,cnpj:string){
 exigir(Buffer.byteLength(xml)<=500_000&&!/<!DOCTYPE|<!ENTITY/i.test(xml),'XML externo inválido.')
 const doc=new DOMParser({onError:()=>{throw Error('XML externo malformado.')}}).parseFromString(xml,'application/xml')
 const raiz=doc.documentElement
 exigir(raiz?.namespaceURI===NFE_NS&&raiz.localName==='nfeProc'&&raiz.getAttribute('versao')==='4.00','Informe o XML processado da NF-e.')
 const nfe=unico(raiz,'NFe'),inf=unico(nfe,'infNFe'),ide=unico(inf,'ide'),emit=unico(inf,'emit'),dest=unico(inf,'dest')
 const prot=unico(unico(raiz,'protNFe'),'infProt')
 const chave=valor(prot,'chNFe'),dados=interpretarChaveNfe(chave,cnpj)
 exigir(dados.modelo==='55'&&dados.serie===2&&chave.startsWith('35')&&inf.getAttribute('Id')==='NFe'+chave,'NF-e fora da série 2 de SP.')
 exigir(valor(emit,'CNPJ')===cnpj&&valor(ide,'tpAmb')==='1'&&valor(prot,'tpAmb')==='1'&&valor(ide,'mod')==='55'&&Number(valor(ide,'serie'))===2&&Number(valor(ide,'nNF'))===dados.numero&&valor(ide,'tpNF')==='1'&&valor(ide,'finNFe')==='1','Dados da operação incompatíveis com a chave.')
 const protocolo=valor(prot,'nProt'),autorizadaEm=new Date(valor(prot,'dhRecbto'))
 exigir(['100','150'].includes(valor(prot,'cStat'))&&/^\d{15}$/.test(protocolo)&&Number.isFinite(autorizadaEm.getTime()),'Arquivo sem protocolo de autorização.')
 const sig=unico(nfe,'Signature',DS),ref=unico(unico(sig,'SignedInfo',DS),'Reference',DS)
 exigir(unico(ref,'DigestValue',DS).textContent?.trim()===valor(prot,'digVal'),'Digest do protocolo não confere.')
 const cert=unico(unico(unico(sig,'KeyInfo',DS),'X509Data',DS),'X509Certificate',DS).textContent?.replace(/\s/g,'')??''
 const pem='-----BEGIN CERTIFICATE-----\n'+cert.match(/.{1,64}/g)?.join('\n')+'\n-----END CERTIFICATE-----'
 const x509=new X509Certificate(pem)
 exigir(x509.subject.includes(cnpj),'Certificado não corresponde ao emitente.')
 const assinado=new XMLSerializer().serializeToString(nfe)
 verificarNfeAssinada(assinado,pem,chave,1)
 validarDocumentoXsd(xml,'autorizado')
 const cpf=Array.from(dest.childNodes).filter((x):x is Element=>x.nodeType===1&&(x as Element).namespaceURI===NFE_NS&&['CPF','CNPJ'].includes((x as Element).localName??''))
 exigir(cpf.length===1&&/^\d{11}(?:\d{3})?$/.test(cpf[0].textContent??''),'Documento do comprador ausente.')
 const itens=Array.from(inf.childNodes).filter((x):x is Element=>x.nodeType===1&&(x as Element).namespaceURI===NFE_NS&&(x as Element).localName==='det').map(d=>{
  const p=unico(d,'prod'),sku=normalizarSkuNfe(valor(p,'cProd')),q=Number(valor(p,'qCom'))
  exigir(sku&&Number.isSafeInteger(q)&&q>0,'Item incompatível com a venda.')
  return {sku,quantidade:q}
 })
 exigir(itens.length>0,'Nota sem itens.')
 return {...dados,chave,protocolo,autorizadaEm,assinado,documento:cpf[0].textContent!,itens,totalCentavos:centavos(valor(unico(unico(inf,'total'),'ICMSTot'),'vNF'))}
}
export function conferirVinculoExterno(nota:Pick<ReturnType<typeof lerNfeExterna>,'documento'|'itens'|'totalCentavos'>,venda:{total:number;documentos:(string|null|undefined)[];itens:{sku:string|null;quantidade:number}[]}){
 const docs=venda.documentos.filter((s):s is string=>!!s).map(s=>s.replace(/\D/g,'')).filter(Boolean)
 exigir(docs.length>0&&docs.every(d=>d===nota.documento),'CPF/CNPJ do comprador não confirmado ou divergente.')
 exigir(Math.round(venda.total*100)===nota.totalCentavos,'Total da NF-e difere da venda.')
 function agrupar(itens:{sku:string|null;quantidade:number}[]){
  const map=new Map<string,number>()
  for(const i of itens){exigir(i.sku&&Number.isSafeInteger(i.quantidade)&&i.quantidade>0,'SKU ou quantidade ausente.');const sku=normalizarSkuNfe(i.sku);map.set(sku,(map.get(sku)??0)+i.quantidade)}
  return JSON.stringify(Array.from(map.entries()).sort(([a],[b])=>a.localeCompare(b)))
 }
 exigir(agrupar(nota.itens)===agrupar(venda.itens),'Itens da NF-e diferem da venda.')
}
export function conferirConsultaExterna(nota:ReturnType<typeof lerNfeExterna>,resposta:string){
 const resultado=interpretarRetornoReal(resposta,'consulta',nota.chave,nota.assinado,null)
 exigir(resultado.status==='autorizada'&&resultado.protocolo===nota.protocolo,'Autorização atual não confirmada pela SEFAZ.')
 // A consulta do protocolo pode vir acompanhada de eventos. Não importar se houver
 // qualquer evento de cancelamento no retorno; exige conciliação administrativa.
 exigir(!/<(?:\w+:)?tpEvento>110111<\/(?:\w+:)?tpEvento>/.test(resposta),'Nota com evento de cancelamento; concilie manualmente.')
 return resultado
}
