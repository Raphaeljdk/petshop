import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { unzipSync } from 'fflate'
import { XmlDocument, XsdValidator, XmlBufferInputProvider, xmlRegisterInputProvider } from 'libxml2-wasm'

export const PACOTE_NFE='PL_010h_v1.03'
const pacotes={
 nfe:{nome:PACOTE_NFE, hash:'bcbf6b277f79a6983d69016dfe0430f09b8a191997a4706a24938acddc18dc81'},
 servicos:{nome:'Servicos_NFe_4.00',hash:'cb146ed32eab3327faa0c09a645cd5745ed0d1da625ceadc5e89d7878aa00e22'},
 cancelamento:{nome:'Evento_Canc_PL_v1.01',hash:'71ccd5fcc48f9604a2a8965146df45e3b73e96e87942ab3391be0d55cc0df718'},
} as const
const entradas={
 nota:['nfe','nfe_v4.00.xsd'], autorizado:['nfe','procNFe_v4.00.xsd'],
 lote:['nfe','enviNFe_v4.00.xsd'], cancelar:['cancelamento','envEventoCancNFe_v1.00.xsd'],
 inutilizar:['servicos','inutNFe_v4.00.xsd'],inutilizacaoProcessada:['servicos','procInutNFe_v4.00.xsd'],
 eventoRegistrado:['cancelamento','procEventoCancNFe_v1.00.xsd'],
} as const
const LIMITE_ZIP=3_000_000
const LIMITE_EXPANDIDO=15_000_000
export class NfeXsdError extends Error{
 constructor(message:string){super(message);this.name='NfeXsdError'}
}
/** Configuração de leitura estritamente local, sem baixar schemas durante emissão. */
const cache=new Map<string,Record<string,Uint8Array>>()
function carregarSchemas(tipo:keyof typeof pacotes) {
 const pacote=pacotes[tipo]
 const ROOT='file:///matilha-nfe-schemas/'+pacote.nome+'/'
 const cached=cache.get(ROOT)
 if(cached)return {ROOT,buffers:cached}
 let zip:Buffer
 try{zip=readFileSync(join(process.cwd(),'public','fiscal-schemas',pacote.nome+'.zip'))}
 catch{throw new NfeXsdError('Pacote fiscal XSD indisponível no servidor.')}
 if(zip.length>LIMITE_ZIP||createHash('sha256').update(zip).digest('hex')!==pacote.hash)
  throw new NfeXsdError('Falha na integridade do pacote XSD.')
 const arquivos=unzipSync(zip, {filter: f => f.name.toLowerCase().endsWith('.xsd')})
 const buffers:Record<string,Uint8Array>={}
 let tamanho=0
 for(const [raw,bytes] of Object.entries(arquivos)){
  const nome=raw.split('/').pop()||''
  if(!/^[A-Za-z0-9_.-]+\.xsd$/i.test(nome)||bytes.byteLength>2_000_000)
   throw new NfeXsdError('Arquivo XSD inválido no pacote.')
  tamanho+=bytes.byteLength
  if(tamanho>LIMITE_EXPANDIDO)throw new NfeXsdError('Pacote XSD excede limite descompactado.')
  if(buffers[ROOT+nome])throw new NfeXsdError('Schema duplicado no pacote: '+nome)
  buffers[ROOT+nome]=bytes
 }
 if(tipo==='nfe'){
  const auxiliares=carregarSchemas('servicos')
  for(const nome of ['procNFe_v4.00.xsd','enviNFe_v4.00.xsd']){
   buffers[ROOT+nome]=auxiliares.buffers[auxiliares.ROOT+nome]
  }
 }
 xmlRegisterInputProvider(new XmlBufferInputProvider(buffers))
 cache.set(ROOT,buffers)
 return {ROOT,buffers}
}
/**
 * Verificação de esquema nacional da NF-e assinada. Nunca gera autorização.
 * Respostas de erro não incluem XML do destinatário, certificado ou segredos.
 */
export function validarDocumentoXsd(xmlNfe:string, entrada:keyof typeof entradas='nota'){
 if(Buffer.byteLength(xmlNfe)>650_000||/<\!DOCTYPE|<\!ENTITY/i.test(xmlNfe))
  throw new NfeXsdError('XML NF-e inválido ou excessivo.')
 const [tipo,ARQUIVO]=entradas[entrada]
 const {buffers,ROOT}=carregarSchemas(tipo)
 const schema=XmlDocument.fromBuffer(buffers[ROOT+ARQUIVO],{url:ROOT+ARQUIVO})
 let validator:XsdValidator|null=null,doc:XmlDocument|null=null
 try{
  validator=XsdValidator.fromDoc(schema)
  doc=XmlDocument.fromString(xmlNfe)
  validator.validate(doc)
  return {valido:true as const,esquema:tipo==='nfe'?'010h v1.03':pacotes[tipo].nome,hashEsquema:pacotes[tipo].hash}
 }catch(error){
  const detalhe=process.env.NODE_ENV==='test' && error instanceof Error
    ? ' Detalhe sintético: '+error.message.slice(0,800) : ''
  throw new NfeXsdError('A NF-e não passou na validação XSD oficial; transmissão bloqueada.'+detalhe)
 }finally{
  doc?.dispose();validator?.dispose();schema.dispose()
 }
}
/** Valida um XML contra um XSD simples nos testes sem usar arquivos fiscais reais. */
export function testarSchemaAutoContido(xml:string,xsd:string){
 const schema=XmlDocument.fromString(xsd)
 let validator:XsdValidator|null=null,doc:XmlDocument|null=null
 try{validator=XsdValidator.fromDoc(schema);doc=XmlDocument.fromString(xml);validator.validate(doc);return true}
 finally{doc?.dispose();validator?.dispose();schema.dispose()}
}

export const validarXmlNfeXsdHomologacao=validarDocumentoXsd
