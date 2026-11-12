import {NextRequest,NextResponse} from 'next/server'
import {randomInt} from 'node:crypto'
import {z} from 'zod'
import {db} from '@/lib/db'
import {getUsuarioLogado} from '@/lib/auth-cookies'
import {AuthError,readAuthBody} from '@/lib/auth-http'
import {lerA1DeVariaveis,SefazComunicacaoError} from '@/lib/sefaz-sp-nfe'
import {extrairCertificadoA1,assinarXmlNfeHomologacao,validarAssinaturaNfeHomologacao,AssinaturaNfeError} from '@/lib/nfe-assinatura-a1'
import {validarXmlNfeXsdHomologacao,NfeXsdError} from '@/lib/nfe-validacao-xsd'
import {gerarRascunhoNfe55,NfeRascunhoError} from '@/lib/nfe-xml-modelo55'
import {montarLoteHomologacao,montarConsultaHomologacao,montarRetornoHomologacao,
 enviarSoapHomologacao,interpretarAutorizacaoHomologacao} from '@/lib/sefaz-sp-nfe-homologacao'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
const headers={'Cache-Control':'private, no-store'}
const fail=(message:string,status=400)=>NextResponse.json({error:message},{status,headers})
const ok=(value:unknown)=>NextResponse.json(value,{headers})
const trib=z.object({base:z.number().finite().min(0).max(1000000),
 aliquota:z.number().finite().min(0).max(100),
 valor:z.number().finite().min(0).max(1000000)}).strict()
const endereco=z.object({
 logradouro:z.string().trim().min(2).max(60),numero:z.string().trim().min(1).max(60),
 bairro:z.string().trim().min(2).max(60),municipio:z.string().trim().min(2).max(60),
 codigoMunicipio:z.string().regex(/^35\d{5}$/),uf:z.literal('SP'),
 cep:z.string().regex(/^\d{8}$/),
}).strict()
const preparar=z.object({
 acao:z.literal('preparar'),quantidade:z.number().int().min(1).max(50),
 valorUnitario:z.number().finite().positive().max(10000)
  .refine(v=>Math.abs(v*100-Math.round(v*100))<0.00001),
 destinatario:z.object({nome:z.string().trim().min(2).max(60),
  documento:z.string().regex(/^(?:\d{11}|\d{14})$/),endereco}).strict(),
 pis:trib,cofins:trib,confirmacao:z.literal('PREPARAR TESTE'),
}).strict()
const acao=z.object({acao:z.enum(['transmitir','consultar']),
 id:z.string().min(1).max(120),confirmacao:z.string().max(80).optional()}).strict()

async function admin(){
 const user=await getUsuarioLogado()
 if(!user)return fail('Não autenticado.',401)
 if(user.role!=='ADMIN')return fail('Apenas administradores.',403)
 return null
}
function credenciais(){
 return lerA1DeVariaveis({SEFAZ_NFE_A1_PFX_BASE64:process.env.SEFAZ_NFE_A1_PFX_BASE64,
  SEFAZ_NFE_A1_SENHA:process.env.SEFAZ_NFE_A1_SENHA})
}
async function configValidada(){
 const e=await db.configuracaoFiscal.findUnique({where:{id:'matilha-prado'}})
 if(!e||e.cnpj?.replace(/\D/g,'')!=='57199062000191'||e.regimeTributario!=='1'
  ||e.uf!=='SP'||e.serieNfe!==2)
  throw new NfeRascunhoError('Emitente, CRT, UF ou série 2 divergente.')
 return e
}
class NfeEtapaError extends Error {
 constructor(readonly etapa:string){
  super('Não foi possível concluir a etapa '+etapa+' da preparação. Nenhuma NF-e foi transmitida.')
  this.name='NfeEtapaError'
 }
}
async function prepararTeste(input:z.infer<typeof preparar>){
 let etapa='cadastro do emitente'
 try {
 const empresa=await configValidada()
 etapa='carregamento do produto'
 const produto=await db.produto.findFirst({where:{sku:'7899669611657',ativo:true},
  select:{id:true,nome:true,sku:true,ncm:true,cest:true,cfop:true,origem:true,csosn:true,
   unidadeFiscal:true,gtinFiscal:true,pisCst:true,cofinsCst:true}})
 if(!produto||produto.ncm!=='39269090'||produto.cfop!=='5102'||produto.csosn!=='102'
  ||produto.origem!=='0'||produto.pisCst!=='49'||produto.cofinsCst!=='49'||produto.cest)
  throw new NfeRascunhoError('Classificação do produto não corresponde à aprovada.')
 etapa='leitura do certificado A1'
 const cred=credenciais()
 etapa='verificação de CNPJ e validade do A1'
 const chaves=extrairCertificadoA1(cred.pfx,cred.passphrase,empresa.cnpj!)
 // A numeração de homologação NÃO altera NotaFiscal, Venda ou estoque.
 etapa='transação de homologação'
 return await db.$transaction(async tx=>{
  etapa='bloqueio de numeração'
  await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(57199062000191)')
  const ultimo=await tx.nfeHomologacao.findFirst({where:{serie:2},orderBy:{numero:'desc'},select:{numero:true}})
  const numero=(ultimo?.numero||0)+1
  if(numero>999999999)throw new NfeRascunhoError('Numeração de homologação esgotada.')
  const total=Number((input.valorUnitario*input.quantidade).toFixed(2))
  const venda={id:'apenas-teste',status:'concluida',canal:'site',
   total,subtotalProdutos:total,valorFrete:0,descontoCupom:0,
   itens:[{produtoId:produto.id,quantidade:input.quantidade,precoUnit:input.valorUnitario,
    produto:{nome:produto.nome,sku:produto.sku,ncm:produto.ncm,cest:produto.cest,
     cfop:produto.cfop,origem:produto.origem,csosn:produto.csosn,unidadeFiscal:produto.unidadeFiscal}}],
  }
  etapa='montagem do XML fiscal'
  const {xml}=gerarRascunhoNfe55(venda,empresa,{
   numero,codigoNumerico:String(randomInt(0,100000000)).padStart(8,'0'),
   naturezaOperacao:'Venda de mercadoria adquirida de terceiros',
   destinatario:{...input.destinatario,indicadorIE:'9'},
   consumidorFinal:'1',pagamento:'17',modalidadeFrete:'9',
   itens:[{produtoId:produto.id,gtin:produto.gtinFiscal||'SEM GTIN',
    pisCst:'49',cofinsCst:'49',pis:input.pis,cofins:input.cofins}],
  })
  etapa='assinatura XMLDSig'
  const assinado=assinarXmlNfeHomologacao(xml,chaves)
  etapa='validação XSD'
  validarXmlNfeXsdHomologacao(assinado.xmlAssinado)
  etapa='gravação do teste'
  const registro=await tx.nfeHomologacao.create({data:{
   serie:2,numero,chave:assinado.chave,ambiente:2,status:'preparada',
   produtoId:produto.id,quantidade:input.quantidade,valorUnitario:input.valorUnitario,
   xmlAssinado:assinado.xmlAssinado,
  },select:{id:true,serie:true,numero:true,chave:true,status:true}})
  return {...registro,assinaturaVerificada:true,xsdValido:true,
   aviso:'NF-e TESTE preparada e validada. Não foi transmitida à SEFAZ.'}
 },{timeout:20000,maxWait:5000})
 }catch(err){
  if(err instanceof NfeRascunhoError||err instanceof AssinaturaNfeError||
     err instanceof NfeXsdError||err instanceof NfeEtapaError)throw err
  const code=(err&&typeof err==='object'&&'code' in err&&
   typeof err.code==='string'&&/^[A-Z0-9_]{1,24}$/.test(err.code))?err.code:null
  // Loga exclusivamente a etapa, a classe e um código técnico padronizado. Nada de XML, senha ou PFX.
  console.error('Falha técnica na preparação fiscal.',{
   etapa,classe:err instanceof Error?err.name:'desconhecida',codigo:code,
  })
  throw new NfeEtapaError(etapa)
 }
}
const semCabecalho=(xml:string)=>xml.replace(/^\s*<\?xml[^>]*\?>\s*/i,'')
 .replace(/^\s*<!--[\s\S]*?-->\s*/,'').trim()
function montarNfeProc(xml:string,soap:string){
 const prot=soap.match(/<(?:[A-Za-z][\w.-]*:)?protNFe\b[^>]*>[\s\S]*?<\/(?:[A-Za-z][\w.-]*:)?protNFe\s*>/)?.[0]
 if(!prot)throw new Error('Protocolo de autorização ausente.')
 return '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">'+
  semCabecalho(xml)+prot+'</nfeProc>'
}
async function registrarRetorno(id:string,soap:string,chave:string,assinado:string){
 const r=interpretarAutorizacaoHomologacao(soap,chave)
 const status=r.autorizada?'autorizada':r.recibo?'recebida':
  (r.protocolo?.status||r.statusLote)>=200?'rejeitada':'incerta'
 const data={
  status,recibo:r.recibo,protocolo:r.protocolo?.numero||null,
  codigoSefaz:r.protocolo?.status||r.statusLote,
  motivoSefaz:r.protocolo?.motivo||r.motivoLote,
  ...(r.autorizada?{xmlAutorizado:montarNfeProc(assinado,soap),autorizadaEm:new Date()}:{})
 }
 await db.nfeHomologacao.update({where:{id},data})
 return {id,chave,status,ambiente:'homologacao',codigoSefaz:data.codigoSefaz,
  motivoSefaz:data.motivoSefaz,protocolo:data.protocolo,recibo:data.recibo}
}
async function transmitir(id:string){
 const nota=await db.nfeHomologacao.findUnique({where:{id}})
 if(!nota||nota.ambiente!==2)return fail('NF-e de homologação inexistente.',404)
 if(nota.status!=='preparada')return fail('Documento já enviado ou pendente. Consulte antes de retransmitir.',409)
 await configValidada()
 validarXmlNfeXsdHomologacao(nota.xmlAssinado)
 const cred=credenciais()
 const chaves=extrairCertificadoA1(cred.pfx,cred.passphrase,'57199062000191')
 validarAssinaturaNfeHomologacao(nota.xmlAssinado,chaves.certificadoPem,nota.chave)
 const updated=await db.nfeHomologacao.updateMany({where:{id,status:'preparada',ambiente:2},
  data:{status:'enviando',enviadaEm:new Date()}})
 if(updated.count!==1)return fail('Documento processado por outra solicitação.',409)
 try{
  const lote=montarLoteHomologacao(semCabecalho(nota.xmlAssinado),String(nota.numero))
  const soap=await enviarSoapHomologacao('autorizacao',lote,cred)
  return ok(await registrarRetorno(id,soap,nota.chave,nota.xmlAssinado))
 }catch(err){
  await db.nfeHomologacao.updateMany({where:{id,status:'enviando'},data:{
   status:'incerta',motivoSefaz:'Comunicação indefinida: consultar antes de reenviar.',
  }})
  if(err instanceof SefazComunicacaoError)return fail(err.message+' O número foi preservado.',502)
  return fail('Retorno da SEFAZ incerto; consulte o protocolo antes de nova tentativa.',502)
 }
}
async function consultar(id:string){
 const nota=await db.nfeHomologacao.findUnique({where:{id}})
 if(!nota||nota.ambiente!==2)return fail('NF-e de teste não encontrada.',404)
 if(nota.status==='preparada')return fail('Documento ainda não transmitido.',409)
 if(nota.status==='autorizada')return ok({id,chave:nota.chave,status:nota.status,
  codigoSefaz:nota.codigoSefaz,protocolo:nota.protocolo})
 const cred=credenciais()
 try{
  const soap=await enviarSoapHomologacao(nota.recibo?'retorno':'consulta',
   nota.recibo?montarRetornoHomologacao(nota.recibo):montarConsultaHomologacao(nota.chave),cred)
  return ok(await registrarRetorno(id,soap,nota.chave,nota.xmlAssinado))
 }catch(err){
  if(err instanceof SefazComunicacaoError)return fail(err.message,502)
  return fail('Consulta indisponível; documento permanece pendente, sem reenvio.',502)
 }
}
export async function GET(){
 const denied=await admin();if(denied)return denied
 const documentos=await db.nfeHomologacao.findMany({orderBy:{createdAt:'desc'},take:15,
  select:{id:true,serie:true,numero:true,chave:true,status:true,codigoSefaz:true,
   motivoSefaz:true,protocolo:true,recibo:true,createdAt:true}})
 return ok({ambiente:'homologacao',documentos,
  aviso:'Apenas testes sem valor fiscal, sem movimentação de estoque ou venda.'})
}
export async function POST(req:NextRequest){
 const denied=await admin();if(denied)return denied
 try{
  const body=await readAuthBody(req)
  const p=preparar.safeParse(body)
  if(p.success){
   for(const [nome,imposto] of [['PIS',p.data.pis],['COFINS',p.data.cofins]] as const){
    if(Math.abs(imposto.base*100-Math.round(imposto.base*100))>0.00001 ||
       Math.abs(imposto.valor*100-Math.round(imposto.valor*100))>0.00001)
      return fail(nome+': base e valor devem ter no máximo duas casas decimais.')
    const esperado=Math.round((imposto.base*imposto.aliquota/100+Number.EPSILON)*100)
    if(esperado!==Math.round(imposto.valor*100))
      return fail(nome+': o valor não corresponde à base e alíquota informadas. Use apenas valores fiscais aprovados pela contadora.')
   }
   return ok(await prepararTeste(p.data))
  }
  const a=acao.safeParse(body)
  if(!a.success)return fail('Dados ou confirmação fiscal inválidos.')
  if(a.data.acao==='consultar')return consultar(a.data.id)
  if(a.data.confirmacao!=='TRANSMITIR HOMOLOGACAO')
   return fail('Confirmação explícita obrigatória para transmitir o teste.')
  return transmitir(a.data.id)
 }catch(err){
  if(err instanceof AuthError)return fail(err.message,err.status)
  if(err instanceof NfeRascunhoError||err instanceof AssinaturaNfeError||err instanceof NfeXsdError||err instanceof NfeEtapaError)
   return fail(err.message,409)
  console.error('Falha de homologação fiscal: dados sensíveis omitidos.')
  return fail('Operação fiscal indisponível. Consulte o registro da nota de teste.',503)
 }
}
