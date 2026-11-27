import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin, authJson } from '@/lib/auth-http'
import { lerNfeExterna, conferirVinculoExterno, conferirConsultaExterna } from '@/lib/nfe-externa-conciliacao'
import { consultaReal, exigir, ErroFiscalReal } from '@/lib/nfe-real-protocolo'
import { lerA1DeVariaveis } from '@/lib/sefaz-sp-nfe'
import { enviarSoapProducao } from '@/lib/sefaz-sp-nfe-homologacao'
import { gerarDanfeAutorizado } from '@/lib/nfe-danfe'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
const entrada=z.object({vendaId:z.string().min(1).max(80),xml:z.string().min(1).max(500000),confirmacao:z.literal('VINCULAR NOTA EXTERNA AO PEDIDO')}).strict()
function erro(e:unknown){return authJson({error:e instanceof ErroFiscalReal?e.message:'Não foi possível validar a NF-e externa. Confira o documento e a consulta à SEFAZ.'},409)}
export async function POST(req:NextRequest){
 try{
  const user=await getUsuarioLogado()
  if(!user||user.role!=='ADMIN')return authJson({error:'Acesso restrito à administração.'},user?403:401)
  assertSameOrigin(req)
  if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return authJson({error:'Envie JSON.'},415)
  const raw=await req.text()
  if(Buffer.byteLength(raw)>550000)return authJson({error:'Arquivo muito grande.'},413)
  const input=entrada.safeParse(JSON.parse(raw))
  if(!input.success)return authJson({error:'Selecione a venda e confirme o vínculo.'},400)
  const {xml,vendaId}=input.data
  const empresa=await db.configuracaoFiscal.findUniqueOrThrow({where:{id:'matilha-prado'}})
  const cnpj=empresa.cnpj?.replace(/\D/g,'')??''
  exigir(empresa.uf==='SP'&&empresa.serieNfe===2&&empresa.ambiente==='producao','Confira o cadastro fiscal do emitente.')
  const nota=lerNfeExterna(xml,cnpj)
  const include={itens:{include:{produto:true}},cliente:true,notaFiscal:true,reservaNfe:true} as const
  const pre=await db.venda.findUniqueOrThrow({where:{id:vendaId},include})
  function conferir(v:typeof pre){
   exigir(['site','amazon'].includes(v.canal)&&v.status==='concluida','Venda fora do fluxo de conciliação.')
   exigir(!v.reservaNfe&&!v.siggmaGuid,'Venda já vinculada a outro fluxo fiscal.')
   conferirVinculoExterno(nota,{total:v.total,documentos:[v.marketplaceBuyerDocument,v.cliente?.cpfCnpj],itens:v.itens.map(i=>({sku:i.produto.sku,quantidade:i.quantidade}))})
   const n=v.notaFiscal
   exigir(!n||n.emissor==='externo_sebrae'&&n.chaveAcesso===nota.chave&&n.protocolo===nota.protocolo&&n.status==='autorizada'||n.modelo==='55'&&n.status==='rascunho'&&!n.emissor&&!n.numero&&!n.chaveAcesso&&!n.protocolo&&!n.xmlAutorizado&&!n.emissorDocumentoId&&!n.emissaoSolicitadaEm,'Venda já possui documento ou emissão em andamento.')
  }
  conferir(pre)
  const consulta=consultaReal(nota.chave,null)
  exigir(consulta.operacao==='consulta','Consulta incompatível.')
  const cred=lerA1DeVariaveis({SEFAZ_NFE_A1_PFX_BASE64:process.env.SEFAZ_NFE_A1_PFX_BASE64,SEFAZ_NFE_A1_SENHA:process.env.SEFAZ_NFE_A1_SENHA})
  const resposta=await enviarSoapProducao('consulta',consulta.xml,cred)
  conferirConsultaExterna(nota,resposta)
  const resultado=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Venda" WHERE id=${vendaId} FOR UPDATE`
   const v=await tx.venda.findUniqueOrThrow({where:{id:vendaId},include})
   conferir(v)
   await tx.$queryRaw`SELECT serie FROM "NfeRealSequencia" WHERE cnpj=${cnpj} AND serie=2 AND ambiente=1 FOR UPDATE`
   const reserva=await tx.nfeRealReserva.findFirst({where:{cnpj,serie:2,ambiente:1,numero:nota.numero},select:{id:true}})
   exigir(!reserva,'Número já reservado pelo ERP; concilie manualmente.')
   const existente=await tx.notaFiscal.findFirst({where:{OR:[{chaveAcesso:nota.chave},{modelo:'55',serie:2,numero:nota.numero}]},select:{vendaId:true}})
   exigir(!existente||existente.vendaId===vendaId,'NF-e ou número já vinculado a outra venda.')
   if(v.notaFiscal?.emissor==='externo_sebrae')return {numero:nota.numero,serie:2,status:'autorizada',jaImportada:true}
   const valores={modelo:'55',serie:2,numero:nota.numero,chaveAcesso:nota.chave,protocolo:nota.protocolo,xmlAutorizado:xml,autorizadaEm:nota.autorizadaEm,consultadaEm:new Date(),emissor:'externo_sebrae',status:'autorizada',erro:null,danfeUrl:'/api/admin/fiscal/externa?vendaId='+encodeURIComponent(vendaId)+'&arquivo=pdf'}
   if(v.notaFiscal){
    const atual=await tx.notaFiscal.updateMany({where:{id:v.notaFiscal.id,status:'rascunho',emissor:null,chaveAcesso:null,numero:null},data:valores})
    exigir(atual.count===1,'A venda foi alterada durante a conciliação.')
   }else await tx.notaFiscal.create({data:{vendaId,...valores}})
   // Não muda sequência, estoque, financeiro nem envia e-mail.
   return {numero:nota.numero,serie:2,status:'autorizada',jaImportada:false}
  },{isolationLevel:'Serializable',timeout:20000})
  return authJson(resultado)
 }catch(e){return erro(e)}
}
export async function GET(req:NextRequest){
 try{
  const user=await getUsuarioLogado()
  if(!user||user.role!=='ADMIN')return authJson({error:'Acesso restrito à administração.'},user?403:401)
  const vendaId=req.nextUrl.searchParams.get('vendaId')??'',arquivo=req.nextUrl.searchParams.get('arquivo')
  if(!vendaId||vendaId.length>80||!['xml','pdf'].includes(arquivo??''))return authJson({error:'Arquivo inválido.'},400)
  const n=await db.notaFiscal.findUnique({where:{vendaId}})
  exigir(n?.emissor==='externo_sebrae'&&n.status==='autorizada'&&n.xmlAutorizado&&n.chaveAcesso&&n.protocolo,'Documento externo indisponível.')
  const pdf=arquivo==='pdf',body=pdf?new Uint8Array(gerarDanfeAutorizado(n.xmlAutorizado)):n.xmlAutorizado
  return new NextResponse(body,{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Type':pdf?'application/pdf':'application/xml; charset=utf-8','Content-Disposition':'attachment; filename="'+(pdf?'DANFE':'NFe')+'-'+n.chaveAcesso+'.'+(pdf?'pdf':'xml')+'"'}})
 }catch(e){return erro(e)}
}
