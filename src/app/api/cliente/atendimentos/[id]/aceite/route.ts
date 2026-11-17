import { NextRequest,NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import { ACEITE_TEXTO,ACEITE_VERSAO } from '@/lib/atendimento-ficha'

export const runtime='nodejs'
type Route={params:Promise<{id:string}>}
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private,no-store'}})
export async function POST(req:NextRequest,{params}:Route){
 const user=await getUsuarioLogado()
 if(user?.role!=='CLIENTE'||!user.clienteId)return reply({error:'É necessário entrar com a conta do tutor.'},401)
 try{assertSameOrigin(req)}catch{return reply({error:'Origem não autorizada.'},403)}
 const {id}=await params
 const raw=await req.text()
 if(raw.length>5000)return reply({error:'Solicitação muito grande.'},413)
 let data:{action?:unknown;confirmed?:unknown;name?:unknown;version?:unknown}
 try{data=JSON.parse(raw)}catch{return reply({error:'Aceite inválido.'},400)}
 if(!data||!['aceitar','recusar'].includes(String(data.action)))return reply({error:'Escolha aceitar ou não autorizar.'},400)
 if(data.version!==ACEITE_VERSAO)return reply({error:'A versão do termo foi atualizada. Recarregue a ficha.'},409)
 const accepted=data.action==='aceitar'
 const name=typeof data.name==='string'?data.name.trim():''
 if(accepted&&(!data.confirmed||name.length<3||name.length>140))
  return reply({error:'Leia o termo, marque a confirmação e informe seu nome completo.'},400)
 const ficha=await db.atendimentoFicha.findFirst({where:{
  id,clienteId:user.clienteId,checkinStatus:'pendente_aceite',checkinSubmittedAt:{not:null},
 },select:{id:true,checkin:true,petId:true,processo:{select:{status:true,pet:{select:{clienteId:true}}}}}})
 if(!ficha)return reply({error:'Ficha não disponível, já respondida ou pertencente a outro tutor.'},404)
 if(!ficha.checkin||ficha.processo.pet.clienteId!==user.clienteId||ficha.processo.status==='cancelado')
  return reply({error:'Este atendimento não permite aceite.'},409)
 const signedContent=JSON.stringify({
  kind:'checkin',version:ACEITE_VERSAO,text:ACEITE_TEXTO,checkin:ficha.checkin,
 })
 const hash=createHash('sha256').update(signedContent,'utf8').digest('hex')
 // Hash de IP com sal do servidor para trilha de auditoria, sem armazenar IP puro.
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||''
 const salt=process.env.NEXTAUTH_SECRET||process.env.ADMIN_BOOTSTRAP_CODE||''
 const ipHash=ip&&salt?createHash('sha256').update(salt+':'+ip).digest('hex'):null
 try{
  const result=await db.$transaction(async tx=>{
   const changed=await tx.atendimentoFicha.updateMany({where:{
    id,clienteId:user.clienteId,checkinStatus:'pendente_aceite',tutorAceiteAt:null,
   },data:{
    checkinStatus:accepted?'aceito':'recusado',tutorAceiteAt:new Date(),
    tutorAceiteUserId:user.id,tutorAceiteNome:accepted?name:user.nome,
    tutorAceiteVersao:ACEITE_VERSAO,tutorAceiteHash:hash,tutorAceiteIpHash:ipHash,
   }})
   if(!changed.count)return false
   await tx.atendimentoFichaEvento.create({data:{
    fichaId:id,actorId:user.id,acao:accepted?'tutor_aceitou':'tutor_recusou',
    resumo:accepted?'Tutor registrou consentimento eletrônico.':'Tutor não autorizou o serviço.',
   }})
   return true
  })
  if(!result)return reply({error:'Esta ficha já foi respondida. Atualize o histórico.'},409)
  return reply({ok:true,status:accepted?'aceito':'recusado',hash})
 }catch(e){
  console.error('[aceite-ficha] falha',e)
  return reply({error:'Não foi possível registrar sua resposta.'},503)
 }
}
