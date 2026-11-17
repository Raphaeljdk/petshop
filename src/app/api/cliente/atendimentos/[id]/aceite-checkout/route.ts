import { NextRequest,NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import { CHECKOUT_ACEITE_TEXTO,CHECKOUT_ACEITE_VERSAO,validarRespostaCheckout } from '@/lib/atendimento-ficha'

export const runtime='nodejs'
type Route={params:Promise<{id:string}>}
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private,no-store'}})

export async function POST(req:NextRequest,{params}:Route){
 const user=await getUsuarioLogado()
 if(user?.role!=='CLIENTE'||!user.clienteId)
  return reply({error:'Entre com a conta do tutor para registrar a ciência do check-out.'},401)
 try{assertSameOrigin(req)}catch{return reply({error:'Origem não autorizada.'},403)}
 const {id}=await params
 const raw=await req.text()
 if(raw.length>5000)return reply({error:'Solicitação muito grande.'},413)
 let data:{action?:unknown;confirmed?:unknown;name?:unknown;version?:unknown}
 try{data=JSON.parse(raw)}catch{return reply({error:'Resposta inválida.'},400)}
 if(!data)return reply({error:'Resposta inválida.'},400)
 if(data.version!==CHECKOUT_ACEITE_VERSAO)
  return reply({error:'A versão do termo mudou. Atualize a ficha antes de responder.'},409)
 const accepted=data.action==='aceitar'
 const name=typeof data.name==='string'?data.name.trim():''
 const validationError=validarRespostaCheckout(data.action,data.name,data.confirmed)
 if(validationError)return reply({error:validationError},400)
 const ownerId=user.clienteId
 const ficha=await db.atendimentoFicha.findFirst({where:{
  id,clienteId:ownerId,checkinStatus:'aceito',
  checkoutFinalizadoAt:{not:null},checkoutAceiteStatus:'pendente',checkoutAceiteAt:null,
 },select:{
  id:true,checkout:true,checkoutFinalizadoAt:true,
  processo:{select:{status:true,pet:{select:{clienteId:true}}}},
 }})
 if(!ficha)return reply({error:'Check-out indisponível, já respondido ou pertencente a outro tutor.'},404)
 if(!ficha.checkout||ficha.processo.pet.clienteId!==ownerId||ficha.processo.status==='cancelado')
  return reply({error:'Este atendimento não permite registrar resposta ao check-out.'},409)
 const signedContent=JSON.stringify({
  kind:'checkout',version:CHECKOUT_ACEITE_VERSAO,text:CHECKOUT_ACEITE_TEXTO,
  checkout:ficha.checkout,finalizadoAt:ficha.checkoutFinalizadoAt,
 })
 const hash=createHash('sha256').update(signedContent,'utf8').digest('hex')
 // O IP bruto não é persistido; apenas hash com segredo do servidor.
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||''
 const salt=process.env.NEXTAUTH_SECRET||process.env.ADMIN_BOOTSTRAP_CODE||''
 const ipHash=ip&&salt?createHash('sha256').update(salt+':'+ip).digest('hex'):null
 try{
  const saved=await db.$transaction(async tx=>{
   const result=await tx.atendimentoFicha.updateMany({where:{
    id,clienteId:ownerId,checkoutFinalizadoAt:{not:null},
    checkoutAceiteStatus:'pendente',checkoutAceiteAt:null,
   },data:{
    checkoutAceiteStatus:accepted?'aceito':'discordo',
    checkoutAceiteAt:new Date(),checkoutAceiteUserId:user.id,
    checkoutAceiteNome:name,checkoutAceiteVersao:CHECKOUT_ACEITE_VERSAO,
    checkoutAceiteHash:hash,checkoutAceiteIpHash:ipHash,
   }})
   if(!result.count)return false
   await tx.atendimentoFichaEvento.create({data:{
    fichaId:id,actorId:user.id,
    acao:accepted?'checkout_tutor_ciente':'checkout_tutor_discordou',
    resumo:accepted?'Tutor confirmou leitura e ciência da ficha de saída.':'Tutor registrou discordância sobre a ficha de saída.',
   }})
   return true
  })
  if(!saved)return reply({error:'O check-out já foi respondido. Atualize o histórico.'},409)
  return reply({ok:true,status:accepted?'aceito':'discordo',hash})
 }catch(e){
  console.error('[checkout-aceite] falha ao registrar resposta',e)
  return reply({error:'Não foi possível registrar a resposta do tutor.'},503)
 }
}
