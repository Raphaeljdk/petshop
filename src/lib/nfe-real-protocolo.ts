import { DOMParser, XMLSerializer, type Element } from '@xmldom/xmldom'
import { xmlText } from './fiscal-preview'
import { validarDocumentoXsd } from './nfe-validacao-xsd'
import { assinarDocumentoFiscal, type ChavesA1 } from './nfe-assinatura-a1'
import type { ServicoReal } from './sefaz-sp-nfe-homologacao'

export const NFE_NS='http://www.portalfiscal.inf.br/nfe'
const DS='http://www.w3.org/2000/09/xmldsig#'
export class ErroFiscalReal extends Error {}
export function exigir(condicao:unknown,mensagem:string):asserts condicao {
 if(!condicao)throw new ErroFiscalReal(mensagem)
}
function documento(xml:string){
 exigir(Buffer.byteLength(xml)<720_000&&!/<!DOCTYPE|<!ENTITY/i.test(xml),'Resposta fiscal inválida.')
 return new DOMParser({onError:()=>{throw new ErroFiscalReal('XML fiscal malformado.')}}).parseFromString(xml,'application/xml')
}
function filho(e:Element,nome:string){
 const itens=Array.from(e.childNodes).filter((x):x is Element=>x.nodeType===1 && (x as Element).namespaceURI===NFE_NS && (x as Element).localName===nome)
 exigir(itens.length<=1,'Elemento fiscal duplicado.')
 return itens[0]
}
const valor=(e:Element,n:string)=>filho(e,n)?.textContent?.trim()||''
const serializar=(e:Element)=>new XMLSerializer().serializeToString(e)
function retorno(xml:string,nome:string){
 const doc=documento(xml)
 const encontrados=doc.getElementsByTagNameNS(NFE_NS,nome)
 exigir(encontrados.length===1&&!doc.getElementsByTagNameNS('*','Fault').length,'Sem retorno SEFAZ inequívoco.')
 const r=encontrados[0]
 return r
}
function codigo(e:Element){
 const n=valor(e,'cStat')
 exigir(/^[1-9]\d{2,3}$/.test(n),'cStat SEFAZ inválido.')
 return Number(n)
}
const semSegredo=(e:Element)=>valor(e,'xMotivo').replace(/[\r\n]/g,' ').slice(0,255)
export function montarLoteReal(xml:string, numero:number){
 const lote='<enviNFe xmlns="'+NFE_NS+'" versao="4.00"><idLote>'+numero+'</idLote><indSinc>1</indSinc>'+xml+'</enviNFe>'
 validarDocumentoXsd(lote,'lote')
 return lote
}
export function consultaReal(chave:string,recibo:string|null){
 exigir(/^\d{44}$/.test(chave),'Chave inválida.')
 if(recibo){
  exigir(/^\d{15}$/.test(recibo),'Recibo inválido.')
  return {operacao:'retorno' as const,xml:'<consReciNFe xmlns="'+NFE_NS+'" versao="4.00"><tpAmb>1</tpAmb><nRec>'+recibo+'</nRec></consReciNFe>'}
 }
 return {operacao:'consulta' as const,xml:'<consSitNFe xmlns="'+NFE_NS+'" versao="4.00"><tpAmb>1</tpAmb><xServ>CONSULTAR</xServ><chNFe>'+chave+'</chNFe></consSitNFe>'}
}
type Estado='autorizada'|'rejeitada'|'incerta'|'recebida'
export function interpretarRetornoReal(xml:string,servico:Exclude<ServicoReal,'cancelamento'|'inutilizacao'>,chave:string,assinado:string,reciboAnterior:string|null){
 const nome={autorizacao:'retEnviNFe',consulta:'retConsSitNFe',retorno:'retConsReciNFe'}[servico]
 const r=retorno(xml,nome)
 exigir(valor(r,'tpAmb')==='1' && (!valor(r,'cUF')||valor(r,'cUF')==='35'),'Ambiente ou UF divergente no retorno.')
 if(servico==='consulta')exigir(valor(r,'chNFe')===chave,'Consulta retornou outra chave.')
 const lote=codigo(r), prot=filho(r,'protNFe'), info=prot&&filho(prot,'infProt')
 const cStat=info?codigo(info):lote
 const infRec=filho(r,'infRec')
 const recibo=valor(r,'nRec')||(infRec&&valor(infRec,'nRec'))||null
 exigir(!recibo||/^\d{15}$/.test(recibo),'Recibo inválido.')
 if(servico==='retorno'&&recibo)exigir(recibo===reciboAnterior,'Recibo de outro lote.')
 let status:Estado='incerta',xmlAutorizado:string|null=null,protocolo:string|null=null,autorizadaEm:Date|null=null
 if(info){
  exigir(valor(info,'tpAmb')==='1'&&valor(info,'chNFe')===chave,'Protocolo de outra chave ou ambiente.')
  if([100,150].includes(cStat)&&[100,150,104].includes(lote)){
   protocolo=valor(info,'nProt')
   autorizadaEm=new Date(valor(info,'dhRecbto'))
   const dig=documento(assinado).getElementsByTagNameNS(DS,'DigestValue')
   exigir(/^\d{15}$/.test(protocolo)&&Number.isFinite(autorizadaEm.getTime())&&dig.length===1&&valor(info,'digVal')===dig[0].textContent,'Protocolo, data ou digest diverge do XML assinado.')
   xmlAutorizado='<nfeProc xmlns="'+NFE_NS+'" versao="4.00">'+assinado+serializar(prot!)+'</nfeProc>'
   validarDocumentoXsd(xmlAutorizado,'autorizado')
   status='autorizada'
  }else if(lote===104&&cStat>=200&&![204,205,206,217,218,301,302,303,539,562,563,656,999].includes(cStat)){
   status='rejeitada'
  }
 }else if([103,105].includes(lote)&&(recibo||reciboAnterior))status='recebida'
 else if(servico==='autorizacao'&&[215,225,243].includes(lote))status='rejeitada'
 return {status,codigo:cStat,motivo:semSegredo(info||r),recibo,protocolo,autorizadaEm,xmlAutorizado,
  ausente:servico==='consulta'&&lote===217&&!info}
}

export function pedidoCancelamento(chave:string,protocolo:string,justificativa:string,chaves:ChavesA1,data:Date){
 exigir(/^\d{44}$/.test(chave)&&/^\d{15}$/.test(protocolo)&&justificativa.trim().length>=15&&justificativa.length<=255,'Dados do cancelamento inválidos.')
 const dh=new Date(data.getTime()-10800000).toISOString().slice(0,19)+'-03:00'
 const xml='<evento xmlns="'+NFE_NS+'" versao="1.00"><infEvento Id="ID110111'+chave+'01"><cOrgao>35</cOrgao><tpAmb>1</tpAmb><CNPJ>'+chaves.cnpj+'</CNPJ><chNFe>'+chave+'</chNFe><dhEvento>'+dh+
  '</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>'+protocolo+'</nProt><xJust>'+xmlText(justificativa.trim())+'</xJust></detEvento></infEvento></evento>'
 const pedido=assinarDocumentoFiscal(xml,chaves,1,'infEvento').xmlAssinado
 loteCancelamento(pedido)
 return pedido
}
export function loteCancelamento(pedido:string){
 const xml='<envEvento xmlns="'+NFE_NS+'" versao="1.00"><idLote>1</idLote>'+pedido+'</envEvento>'
 validarDocumentoXsd(xml,'cancelar')
 return xml
}
export function retornoCancelamento(xml:string,chave:string,pedido:string,consulta=false){
 const r=retorno(xml,consulta?'retConsSitNFe':'retEnvEvento')
 exigir(valor(r,'tpAmb')==='1','Evento de outro ambiente.')
 if(consulta)exigir(valor(r,'chNFe')===chave,'Consulta de outra chave.')
 else exigir(codigo(r)===128,'Lote de eventos sem processamento confirmado.')
 const eventos=Array.from(r.getElementsByTagNameNS(NFE_NS,'retEvento')).filter(el=>{
  const inf=filho(el,'infEvento')
  return inf && valor(inf,'tpAmb')==='1' && valor(inf,'chNFe')===chave && valor(inf,'tpEvento')==='110111' && valor(inf,'nSeqEvento')==='1' && valor(inf,'cOrgao')==='35'
 })
 if(consulta&&!eventos.length)return null
 exigir(eventos.length===1,'Retorno de cancelamento divergente.')
 const inf=filho(eventos[0],'infEvento')!,cStat=codigo(inf),numero=valor(inf,'nProt')
 const registrado=[135,155].includes(cStat)
 const status=registrado?'registrada':([136,573,656,999].includes(cStat)?'incerta':'rejeitada')
 const proc=registrado?'<procEventoNFe xmlns="'+NFE_NS+'" versao="1.00">'+pedido+serializar(eventos[0])+'</procEventoNFe>':null
 if(proc){
  exigir(/^\d{15}$/.test(numero),'Cancelamento sem protocolo válido.')
  validarDocumentoXsd(proc,'eventoRegistrado')
 }
 return {status,protocolo:registrado?numero:null,xmlProcessado:proc,motivo:semSegredo(inf)}
}

export function inutilizacaoDisponivel(agora=new Date()){
 return agora>=new Date('2026-11-01T00:00:00-03:00')&&agora<new Date('2027-04-01T00:00:00-03:00')
}
export function pedidoInutilizacao(chave:string,justificativa:string,chaves:ChavesA1,agora=new Date()){
 exigir(inutilizacaoDisponivel(agora),'A janela de transição da inutilização em SP está encerrada.')
 exigir(/^35\d{42}$/.test(chave)&&chave.slice(6,20)===chaves.cnpj&&chave.slice(20,25)==='55002','Reserva incompatível com SP, série 2.')
 exigir(justificativa.trim().length>=15&&justificativa.length<=255,'Informe a justificativa operacional.')
 const ano=chave.slice(2,4),n=chave.slice(25,34),num=Number(n)
 const id='ID35'+ano+chaves.cnpj+'55'+'002'+n+n
 const xml='<inutNFe xmlns="'+NFE_NS+'" versao="4.00"><infInut Id="'+id+'"><tpAmb>1</tpAmb><xServ>INUTILIZAR</xServ><cUF>35</cUF><ano>'+ano+'</ano><CNPJ>'+chaves.cnpj+'</CNPJ><mod>55</mod><serie>2</serie><nNFIni>'+num+'</nNFIni><nNFFin>'+num+'</nNFFin><xJust>'+xmlText(justificativa.trim())+'</xJust></infInut></inutNFe>'
 const pedido=assinarDocumentoFiscal(xml,chaves,1,'infInut').xmlAssinado
 validarDocumentoXsd(pedido,'inutilizar')
 return pedido
}
export function retornoInutilizacao(xml:string,pedido:string){
 const r=retorno(xml,'retInutNFe'),inf=filho(r,'infInut'),orig=filho(retorno(pedido,'inutNFe'),'infInut')
 exigir(inf&&orig&&valor(inf,'tpAmb')==='1'&&valor(inf,'cUF')==='35','Retorno de inutilização incompatível.')
 const c=codigo(inf),numero=valor(inf,'nProt'),motivo=semSegredo(inf)
 if(c!==102)return {status:[256,563,656,999].includes(c)?'incerta':'rejeitada',motivo,protocolo:null,xmlProcessado:null}
 exigir(['ano','CNPJ','mod','serie','nNFIni','nNFFin'].every(tag=>valor(inf,tag)===valor(orig,tag))&&/^\d{15}$/.test(numero),'Protocolo ou faixa da inutilização divergente.')
 const proc='<ProcInutNFe xmlns="'+NFE_NS+'" versao="4.00">'+pedido+serializar(r)+'</ProcInutNFe>'
 // O nome da raiz é definido no procInutNFe_v4.00.xsd publicado no Portal Nacional.
 validarDocumentoXsd(proc,'inutilizacaoProcessada')
 return {status:'aceita',motivo,protocolo:numero,xmlProcessado:proc}
}
