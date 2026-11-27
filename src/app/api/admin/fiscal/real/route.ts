import { situacaoEmissao } from '@/lib/nfe-real-prontidao'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { AuthError, authJson, readAuthBody } from '@/lib/auth-http'
import { emissorReal, resumoReal } from '@/lib/nfe-real-servico'
import { complementoFiscal } from '@/lib/nfe-real-venda'
import { ErroFiscalReal,inutilizacaoDisponivel } from '@/lib/nfe-real-protocolo'
import { NfeRascunhoError } from '@/lib/nfe-xml-modelo55'
import { NfeXsdError } from '@/lib/nfe-validacao-xsd'
import { AssinaturaNfeError } from '@/lib/nfe-assinatura-a1'
import { gerarDanfeAutorizado } from '@/lib/nfe-danfe'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
const id=z.string().trim().min(1).max(80)
const motivo=z.string().trim().min(15).max(255)
const base=z.object({vendaId:id})
const requisicao=z.discriminatedUnion('acao',[
 base.extend({acao:z.literal('conferir_amazon')}).strict(),
 base.extend({acao:z.literal('preparar'),dados:complementoFiscal}).strict(),
 base.extend({acao:z.literal('corrigir'),dados:complementoFiscal}).strict(),
 base.extend({acao:z.literal('transmitir'),confirmacao:z.literal('EMITIR VENDA SELECIONADA')}).strict(),
 base.extend({acao:z.literal('retransmitir'),confirmacao:z.literal('REENVIAR MESMO XML')}).strict(),
 base.extend({acao:z.literal('consultar')}).strict(),
 base.extend({acao:z.literal('cancelar'),semCirculacao:z.literal(true),justificativa:motivo}).strict(),
 base.extend({acao:z.literal('reenviar_cancelamento'),semCirculacao:z.literal(true)}).strict(),
 base.extend({acao:z.literal('inutilizar'),confirmacao:z.literal('INUTILIZAR NUMERO DESTA VENDA'),justificativa:motivo}).strict(),
 base.extend({acao:z.literal('quebra'),justificativa:motivo}).strict(),
])
async function admin(){
 const user=await getUsuarioLogado()
 if(!user||user.role!=='ADMIN')throw new AuthError('Acesso restrito à administração.',user?403:401)
 return user
}
function falha(e:unknown){
 if(e instanceof AuthError)return authJson({error:e.message},e.status)
 if(e instanceof ErroFiscalReal||e instanceof NfeRascunhoError||e instanceof NfeXsdError||e instanceof AssinaturaNfeError)
  return authJson({error:e.message},409)
 return authJson({error:'Operação fiscal indisponível. Consulte a situação da venda.'},503)
}
export async function GET(req:NextRequest){
 try{
  await admin()
  const vendaId=req.nextUrl.searchParams.get('vendaId'),arquivo=req.nextUrl.searchParams.get('arquivo')
  if(!id.safeParse(vendaId).success)return authJson({error:'Selecione a venda.'},400)
  const venda=await db.venda.findUnique({where:{id:vendaId!},select:{
   canal:true,enderecoEntrega:true,cepEntrega:true,cliente:{select:{endereco:true,cep:true}},reservaNfe:{include:{cancelamento:true,inutilizacao:true}},
   notaFiscal:{select:{emissor:true,status:true,xmlAutorizado:true,protocolo:true}},
  }})
  if(!venda)return authJson({error:'Venda não encontrada.'},404)
  const r=venda.reservaNfe,n=venda.notaFiscal
  if(arquivo==='inutilizacao'&&r?.chave&&r.inutilizacao?.status==='aceita'&&r.inutilizacao.xmlProcessado){
   return new NextResponse(r.inutilizacao.xmlProcessado,{headers:{'Cache-Control':'private, no-store','Content-Type':'application/xml; charset=utf-8','Content-Disposition':'attachment; filename="Inutilizacao-'+r.chave+'.xml"'}})
  }
  if(arquivo){
   if(!r?.chave||!n?.xmlAutorizado||!n.protocolo||n.emissor!=='matilha_prado'||!['autorizada','cancelada'].includes(n.status))return authJson({error:'Documento autorizado indisponível.'},409)
   const evento=r.cancelamento?.xmlProcessado
   if(!['pdf','xml','evento'].includes(arquivo)||arquivo==='evento'&&!evento)return authJson({error:'Arquivo indisponível.'},404)
   const pdf=arquivo==='pdf'
   const conteudo=pdf?new Uint8Array(gerarDanfeAutorizado(n.xmlAutorizado,evento??undefined)):arquivo==='evento'?evento!:n.xmlAutorizado
   return new NextResponse(conteudo,{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
    'Content-Type':pdf?'application/pdf':'application/xml; charset=utf-8','Content-Disposition':'attachment; filename="'+(pdf?'DANFE':arquivo==='evento'?'Cancelamento':'NFe')+'-'+r.chave+'.'+(pdf?'pdf':'xml')+'"'}})
  }
  const situacao=await situacaoEmissao(await db.configuracaoFiscal.findUnique({where:{id:'matilha-prado'}}))
  return authJson({canal:venda.canal,habilitado:situacao.habilitada,transicao:inutilizacaoDisponivel(),inutilizacao:r?.inutilizacao?{status:r.inutilizacao.status,motivo:r.inutilizacao.motivo}:null,reserva:r?resumoReal(r):null,evento:r?.cancelamento?{status:r.cancelamento.status,motivo:r.cancelamento.motivo}:null,
   endereco:venda.enderecoEntrega||venda.cliente?.endereco,cep:venda.cepEntrega||venda.cliente?.cep})
 }catch(e){return falha(e)}
}
export async function POST(req:NextRequest){
 try{
  const user=await admin(),input=requisicao.safeParse(await readAuthBody(req))
  if(!input.success)return authJson({error:'Confira os dados e a confirmação da venda selecionada.'},400)
  const d=input.data,s=emissorReal()
  switch(d.acao){
   case 'conferir_amazon': return authJson(await s.conferirPedidoAmazon(d.vendaId))
   case 'corrigir': case 'preparar': return authJson(await s.preparar(d.vendaId,user.id,d.dados,d.acao==='corrigir'))
   case 'retransmitir': case 'transmitir': return authJson(await s.enviar(d.vendaId,user.id,d.acao==='retransmitir'))
   case 'consultar': return authJson(await s.consultar(d.vendaId,user.id))
   case 'cancelar': return authJson(await s.cancelar(d.vendaId,user.id,d.justificativa))
   case 'reenviar_cancelamento': return authJson(await s.reenviarCancelamento(d.vendaId,user.id))
   case 'inutilizar': return authJson(await s.inutilizar(d.vendaId,user.id,d.justificativa))
   case 'quebra': return authJson(await s.registrarQuebra(d.vendaId,user.id,d.justificativa))
  }
 }catch(e){return falha(e)}
}
