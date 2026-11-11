/**
 * Transporte SOAP de NF-e 4.00 em homologação SEFAZ-SP.
 * INTERNO: não expõe endpoint nem habilita emissão. O chamador deverá validar XSD
 * e verificar XMLDSig antes da transmissão. Não registrar segredos nem XML completo.
 */
import {request as httpsRequest} from 'node:https'
import {rootCertificates} from 'node:tls'
import {ICP_BRASIL_V10,SEFAZ_SP,SefazComunicacaoError,classificarErroTransporteSefaz} from './sefaz-sp-nfe'

const NS='http://www.portalfiscal.inf.br/nfe'
const SERVICOS={
 autorizacao:{url:SEFAZ_SP.homologacao.autorizacao,ns:NS+'/wsdl/NFeAutorizacao4',acao:'nfeAutorizacaoLote'},
 retorno:{url:'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',ns:NS+'/wsdl/NFeRetAutorizacao4',acao:'nfeRetAutorizacaoLote'},
 consulta:{url:SEFAZ_SP.homologacao.consulta,ns:NS+'/wsdl/NFeConsultaProtocolo4',acao:'nfeConsultaNF'},
} as const
type Operacao=keyof typeof SERVICOS
type Credenciais={pfx:Buffer;passphrase:string}

function campoXml(xml:string,tag:string):string|null{
 if(!/^[A-Za-z]+$/.test(tag))throw Error('Tag fiscal inválida.')
 const regex=new RegExp('<(?:[A-Za-z_][\\w.-]*:)?'+tag+'(?:\\s[^<>]*?)?>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?'+tag+'\\s*>','g')
 const valores=[...xml.matchAll(regex)]
 return valores.length===1?valores[0][1]:null
}
const campo=(xml:string,tag:string)=>{
 const valor=campoXml(xml,tag)
 return valor&&!/[<>]/.test(valor)?valor.trim():null
}
const motivo=(v:string|null)=>(v||'Sem motivo informado').replace(/[^\p{L}\p{N} .,;:()\/-]/gu,'').slice(0,180)
const falha=(xml:string)=>{
 if(xml.length>700_000||/<(?:\w+:)?Fault(?:\s|>)/i.test(xml))
  throw new SefazComunicacaoError('soap','SOAP Fault ou resposta SEFAZ excessiva.')
}
export type ResultadoAutorizacao = {
 ambiente:2;statusLote:number;motivoLote:string;recibo:string|null;
 protocolo:{status:number;chave:string;numero:string|null;motivo:string}|null;
 autorizada:boolean;
}
/** Só retorna autorizada quando a SEFAZ confirma chave, status e protocolo. */
export function interpretarAutorizacaoHomologacao(xml:string,chaveEsperada:string):ResultadoAutorizacao{
 if(!/^\d{44}$/.test(chaveEsperada))throw Error('Chave esperada inválida.')
 falha(xml)
 const retorno=campoXml(xml,'retEnviNFe')||campoXml(xml,'retConsReciNFe')||campoXml(xml,'retConsSitNFe')
 if(!retorno)throw new SefazComunicacaoError('resposta','Resposta SEFAZ não reconhecida.')
 const cabecalho=retorno.replace(/<(?:\w+:)?protNFe\b[^>]*>[\s\S]*?<\/(?:\w+:)?protNFe\s*>/g,'')
 if(campo(cabecalho,'tpAmb')!=='2')throw new SefazComunicacaoError('ambiente','Resposta não é de homologação.')
 const status=Number(campo(cabecalho,'cStat'))
 if(!Number.isInteger(status)||status<100||status>999)
  throw new SefazComunicacaoError('resposta','Código cStat inválido.')
 const protocoloXml=campoXml(retorno,'protNFe')
 const info=protocoloXml?campoXml(protocoloXml,'infProt'):null
 const codigo=info?Number(campo(info,'cStat')):null
 const chave=info?campo(info,'chNFe'):null
 if(info&&chave!==chaveEsperada)
  throw new SefazComunicacaoError('protocolo','Chave do protocolo difere da NF-e enviada.')
 const numero=info?campo(info,'nProt'):null
 const protocolo=info&&codigo!==null&&Number.isInteger(codigo)?
  {status:codigo,chave:chave!,numero:numero||null,motivo:motivo(campo(info,'xMotivo'))}:null
 const recibo=campo(cabecalho,'nRec')
 if(recibo&&!/^\d{15}$/.test(recibo))
  throw new SefazComunicacaoError('recibo','Recibo SEFAZ inválido.')
 return {ambiente:2,statusLote:status,motivoLote:motivo(campo(cabecalho,'xMotivo')),
  recibo:recibo||null,protocolo,
  autorizada:!!(protocolo&&[100,150].includes(protocolo.status)&&/^\d{15}$/.test(protocolo.numero||''))}
}
export function montarConsultaHomologacao(chave:string):string{
 if(!/^\d{44}$/.test(chave))throw Error('Chave de 44 dígitos necessária.')
 return '<consSitNFe versao="4.00" xmlns="'+NS+'"><tpAmb>2</tpAmb><xServ>CONSULTAR</xServ><chNFe>'+
  chave+'</chNFe></consSitNFe>'
}
export function montarRetornoHomologacao(recibo:string):string{
 if(!/^\d{15}$/.test(recibo))throw Error('Recibo de 15 dígitos necessário.')
 return '<consReciNFe versao="4.00" xmlns="'+NS+'"><tpAmb>2</tpAmb><nRec>'+recibo+'</nRec></consReciNFe>'
}
export function montarLoteHomologacao(xmlAssinado:string,idLote:string):string{
 if(!/^\d{1,15}$/.test(idLote))throw Error('Id de lote inválido.')
 if(!/(?:<|:)(?:Signature)(?:\s|>)/.test(xmlAssinado))throw Error('NF-e sem elemento de assinatura.')
 if(!/<(?:\w+:)?tpAmb>2<\/(?:\w+:)?tpAmb>/.test(xmlAssinado))
  throw Error('Somente homologação é permitida.')
 if(/<\?xml|<!DOCTYPE|<!ENTITY|<enviNFe/i.test(xmlAssinado)||xmlAssinado.length>500_000)
  throw Error('Conteúdo XML de NF-e inválido ou excessivo.')
 // OBS: elemento Signature não comprova XMLDSig válida. Falta validação criptográfica externa.
 return '<enviNFe xmlns="'+NS+'" versao="4.00"><idLote>'+idLote+
  '</idLote><indSinc>1</indSinc>'+xmlAssinado+'</enviNFe>'
}
export function envelopeSoapHomologacao(operacao:Operacao,conteudo:string):string{
 if(Buffer.byteLength(conteudo,'utf8')>550_000)throw Error('Solicitação SEFAZ excede limite.')
 const svc=SERVICOS[operacao]
 return '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">'+
  '<soap12:Body><nfeDadosMsg xmlns="'+svc.ns+'">'+conteudo+
  '</nfeDadosMsg></soap12:Body></soap12:Envelope>'
}
/** Sem rota pública. Evita resposta parcial, HTTPS sem verificação e excesso de dados. */
export async function enviarSoapHomologacao(operacao:Operacao,xml:string,cred:Credenciais):Promise<string>{
 const svc=SERVICOS[operacao],url=new URL(svc.url)
 const payload=envelopeSoapHomologacao(operacao,xml)
 return new Promise<string>((resolve,reject)=>{
  const req=httpsRequest(url,{method:'POST',pfx:cred.pfx,passphrase:cred.passphrase,
   minVersion:'TLSv1.2',maxVersion:'TLSv1.2',servername:url.hostname,
   ca:[...rootCertificates,ICP_BRASIL_V10],rejectUnauthorized:true,timeout:15_000,
   headers:{
    'Content-Type':'application/soap+xml; charset=utf-8; action="'+svc.ns+'/'+svc.acao+'"',
    'Content-Length':String(Buffer.byteLength(payload)),
   },
  },res=>{
   const partes:Buffer[]=[];let tamanho=0
   res.on('data',(c:Buffer)=>{tamanho+=c.length
    if(tamanho>700_000){req.destroy(new Error('Resposta fiscal excessiva.'));return}
    partes.push(c)
   })
   res.on('error',reject)
   res.on('end',()=>{
    if(res.statusCode!==200){reject(new SefazComunicacaoError('http','SEFAZ HTTP '+(res.statusCode||0)+'.'));return}
    const body=Buffer.concat(partes).toString('utf8')
    try{falha(body);resolve(body)}catch(e){reject(e)}
   })
  })
  req.on('timeout',()=>req.destroy(Object.assign(new Error('Timeout'),{code:'ETIMEDOUT'})))
  req.on('error',e=>reject(e instanceof SefazComunicacaoError?e:classificarErroTransporteSefaz(e)))
  req.end(payload)
 })
}
