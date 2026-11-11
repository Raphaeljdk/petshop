import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { unzipSync } from 'fflate'
import { XmlDocument, XsdValidator, XmlBufferInputProvider, xmlRegisterInputProvider } from 'libxml2-wasm'

const ROOT='file:///matilha-nfe-schemas/'
const PACOTE='PL_010g_v1.03.zip'
const ARQUIVO='enviNFe_v4.00.xsd'
const LIMITE_ZIP=3_000_000
const LIMITE_EXPANDIDO=15_000_000
export class NfeXsdError extends Error{
 constructor(message:string){super(message);this.name='NfeXsdError'}
}
/** Configuração de leitura estritamente local, sem baixar schemas durante emissão. */
let providerRegistered=false
function carregarSchemas(){
 let zip:Buffer
 try{zip=readFileSync(join(process.cwd(),'public','fiscal-schemas',PACOTE))}
 catch{throw new NfeXsdError('Pacote fiscal XSD 010g não está instalado no servidor. Emissão bloqueada.')}
 if(zip.byteLength>LIMITE_ZIP||zip.byteLength<1000)
  throw new NfeXsdError('Arquivo do pacote XSD fora dos limites.')
 const sha256=createHash('sha256').update(zip).digest('hex')
 // Pin SHA exigido pelo arquivo de referência versionado junto ao pacote no repositório.
 let shaEsperado=''
 try{shaEsperado=readFileSync(join(process.cwd(),'public','fiscal-schemas','PL_010g_v1.03.sha256'),'utf8').trim()}
 catch{throw new NfeXsdError('Manifesto de integridade dos esquemas fiscais não disponível.')}
 if(!/^[a-f0-9]{64}$/.test(shaEsperado)||sha256!==shaEsperado)
  throw new NfeXsdError('O pacote XSD não corresponde ao hash versionado.')
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
 if(!buffers[ROOT+ARQUIVO])throw new NfeXsdError('O pacote XSD não contém '+ARQUIVO+'.')
 return {buffers,sha256}
}
/**
 * Verificação de esquema nacional do lote assinado. Nunca gera autorização.
 * Respostas de erro não incluem XML do destinatário, certificado ou segredos.
 */
export function validarLoteXsdHomologacao(xmlLote:string){
 if(xmlLote.length>500_000||/<\!DOCTYPE|<\!ENTITY/i.test(xmlLote))
  throw new NfeXsdError('Lote de NF-e inválido ou excessivo.')
 const {buffers,sha256}=carregarSchemas()
 if(!providerRegistered){
  xmlRegisterInputProvider(new XmlBufferInputProvider(buffers))
  providerRegistered=true
 }
 const schema=XmlDocument.fromBuffer(buffers[ROOT+ARQUIVO],{url:ROOT+ARQUIVO})
 let validator:XsdValidator|null=null,doc:XmlDocument|null=null
 try{
  validator=XsdValidator.fromDoc(schema)
  doc=XmlDocument.fromString(xmlLote)
  validator.validate(doc)
  return {valido:true as const,esquema:'010g v1.03',hashEsquema:sha256}
 }catch{
  throw new NfeXsdError('O lote NF-e não passou na validação XSD oficial; transmissão bloqueada.')
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
