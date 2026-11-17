import { NextRequest,NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin, AuthError } from '@/lib/auth-http'
import { answerCount, sanitizeFormAnswers, type FormAnswers } from '@/lib/atendimento-ficha'
import { Prisma } from '@prisma/client'

export const runtime='nodejs'
export const dynamic='force-dynamic'
type Route={params:Promise<{id:string}>}
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private,no-store'}})

async function staff() {
 const u=await getUsuarioLogado()
 return u&&['ADMIN','KANBAN'].includes(u.role)?u:null
}
export async function GET(_req:NextRequest,{params}:Route){
 const user=await staff()
 if(!user)return response({error:'Acesso restrito à equipe.'},403)
 const {id}=await params
 const processo=await db.processo.findUnique({
  where:{id},select:{id:true,servico:true,status:true,petId:true,pet:{select:{
   id:true,nome:true,raca:true,especie:true,clienteId:true,cliente:{select:{nome:true,telefone:true}},
  }}},
 })
 if(!processo)return response({error:'Atendimento não encontrado.'},404)
 const ficha=await db.atendimentoFicha.findUnique({where:{processoId:id},include:{
  eventos:{orderBy:{createdAt:'asc'},take:50},
 }})
 return response({processo,ficha})
}
export async function PUT(req:NextRequest,{params}:Route){
 const user=await staff()
 if(!user)return response({error:'Acesso restrito à equipe.'},403)
 try{assertSameOrigin(req)}catch{return response({error:'Origem não permitida.'},403)}
 const {id}=await params
 const payload=await req.json().catch(()=>null) as {action?:unknown;answers?:unknown}|null
 if(!payload||!['salvar_checkin','enviar_checkin','salvar_checkout','finalizar_checkout'].includes(String(payload.action)))
  return response({error:'Ação de ficha inválida.'},400)
 const action=String(payload.action)
 const kind=action.endsWith('checkin')?'checkin':'checkout'
 let answers:FormAnswers
 try {answers=sanitizeFormAnswers(kind,payload.answers)}catch(e){
  return response({error:e instanceof Error?e.message:'Formulário inválido.'},400)
 }
 if(action==='enviar_checkin'){
  const missing=Array.from({length:10},(_,i)=>'saude'+(i+1)).concat('chegadaCondicao')
   .filter(k=>!answers[k])
  if(missing.length)return response({error:'Antes de enviar ao tutor, responda as dez perguntas de saúde e a condição geral de chegada. Use "Não informado" quando necessário.'},400)
  for(const key of ['saude1','saude2','saude3','saude4','saude6','saude7','saude9','saude10']){
   if(answers[key]==='Sim'&&!answers[key+'det'])
    return response({error:'Descreva a condição informada em '+key+' antes de enviar ao tutor.'},400)
  }
 }
 if(action==='finalizar_checkout'&&(!answers.secaCondicao||!answers.saidaCondicao||!answers.saidaFinalizador))
  return response({error:'Informe a condição da secagem, a condição de saída e o responsável pela finalização.'},400)
 if(answerCount(answers)===0)return response({error:'Preencha pelo menos um campo antes de salvar.'},400)
 try{
  const result=await db.$transaction(async tx=>{
   const processo=await tx.processo.findUnique({where:{id},select:{id:true,petId:true,status:true,
    pet:{select:{clienteId:true}}}})
   if(!processo) return {error:'Atendimento não encontrado.',status:404}
   if(processo.status==='cancelado')return {error:'Atendimento cancelado. Não é possível preencher fichas.',status:409}
   const ficha=await tx.atendimentoFicha.upsert({
    where:{processoId:id},
    create:{processoId:id,petId:processo.petId,clienteId:processo.pet.clienteId},
    update:{},
   })
   const isCheckin=kind==='checkin'
   if(isCheckin&&ficha.checkinStatus!=='rascunho')
    return {error:'Check-in já enviado ao tutor. Seu conteúdo ficou bloqueado para proteger o aceite.',status:409}
   if(!isCheckin&&processo.status==='novo')
    return {error:'Registre o início do atendimento antes do check-out.',status:409}
   if(!isCheckin&&ficha.checkinStatus!=='aceito')
    return {error:'É necessário o aceite do tutor no check-in antes do check-out.',status:409}
   if(!isCheckin&&ficha.checkoutFinalizadoAt)
    return {error:'Check-out finalizado e preservado no histórico.',status:409}
   const data=isCheckin?{
    checkin:answers as Prisma.InputJsonValue,checkinById:user.id,
    ...(action==='enviar_checkin'?{checkinStatus:'pendente_aceite',checkinSubmittedAt:new Date()}:{})
   }:{
    checkout:answers as Prisma.InputJsonValue,checkoutById:user.id,
    ...(action==='finalizar_checkout'?{checkoutFinalizadoAt:new Date()}:{})
   }
   const where=isCheckin?{id:ficha.id,checkinStatus:'rascunho'}:
    {id:ficha.id,checkinStatus:'aceito',checkoutFinalizadoAt:null}
   const changed=await tx.atendimentoFicha.updateMany({where,data})
   if(!changed.count)return {error:'Ficha modificada por outra pessoa. Reabra para conferir.',status:409}
   await tx.atendimentoFichaEvento.create({data:{
    fichaId:ficha.id,actorId:user.id,acao:action,
    resumo:isCheckin?'Equipe registrou a avaliação inicial.':'Equipe registrou a avaliação de saída.',
   }})
   return {ok:true,action}
  })
  return 'error'in result?response({error:result.error},result.status):response(result)
 }catch(e){
  console.error('[ficha-atendimento] falha ao salvar:',e)
  return response({error:'Não foi possível salvar a ficha.'},503)
 }
}
