import { NextRequest,NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import { CHECKOUT_ACEITE_TEXTO,CHECKOUT_ACEITE_VERSAO } from '@/lib/atendimento-ficha'

export const runtime='nodejs'
export const dynamic='force-dynamic'
type Route={params:Promise<{id:string}>}
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private,no-store'}})

export async function POST(req:NextRequest,{params}:Route){
 const user=await getUsuarioLogado()
 if(user?.role!=='CLIENTE'||!user.clienteId)
  return reply({error:'É necessário entrar com a conta do tutor.'},401)
 const ownerId=user.clienteId as string
 try{assertSameOrigin(req)}catch{return reply({error:'Origem não autorizada.'},403)}

 const {id}=await params
 const raw=await req.text()
 if(raw.length>5000)return reply({error:'Solicitação muito grande.'},413)
 let data:{action?:unknown;confirmed?:unknown;name?:unknown;version?:unknown}
 try{data=JSON.parse(raw)}catch{return reply({error:'Resposta inválida.'},400)}
 if(!data||!['aceitar','recusar'].includes(String(data.action)))
  return reply({error:'Escolha confirmar ciência ou registrar discordância.'},400)
 if(data.version!==CHECKOUT_ACEITE_VERSAO)
  return reply({error:'O termo de check-out foi atualizado. Recarregue a ficha.'},409)

 const accepted=data.action==='aceitar'
 const name=typeof data.name==='string'?data.name.trim():''
 if(accepted&&(data.confirmed!==true||name.length<3||name.length>140))
  return reply({error:'Leia a ficha e o termo, marque a confirmação e informe seu nome completo.'},400)

 const ficha=await db.atendimentoFicha.findFirst({where:{
  id,clienteId:ownerId,checkoutStatus:'pendente_aceite',checkoutFinalizadoAt:{not:null},
 },select:{
  id:true,checkout:true,checkoutFinalizadoAt:true,
  processo:{select:{status:true,pet:{select:{clienteId:true}}}},
 }})
 if(!ficha)return reply({error:'Ficha de saída não disponível, já respondida ou pertencente a outro tutor.'},404)
 if(!ficha.checkout||!ficha.checkoutFinalizadoAt||ficha.processo.pet.clienteId!==ownerId||ficha.processo.status==='cancelado')
  return reply({error:'Este atendimento não permite registrar ciência da saída.'},409)

 const signedContent=JSON.stringify({
  kind:'checkout',version:CHECKOUT_ACEITE_VERSAO,text:CHECKOUT_ACEITE_TEXTO,
  checkout:ficha.checkout,finalizadoEm:ficha.checkoutFinalizadoAt.toISOString(),
 })
 const hash=createHash('sha256').update(signedContent,'utf8').digest('hex')
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||''
 const salt=process.env.NEXTAUTH_SECRET||process.env.ADMIN_BOOTSTRAP_CODE||''
 const ipHash=ip&&salt?createHash('sha256').update(salt+':'+ip).digest('hex'):null

 try{
  const success=await db.$transaction(async tx=>{
   const updated=await tx.atendimentoFicha.updateMany({where:{
    id,clienteId:ownerId,checkoutStatus:'pendente_aceite',
    checkoutFinalizadoAt:{not:null},checkoutAceiteAt:null,
   },data:{
    checkoutStatus:accepted?'aceito':'recusado',
    checkoutAceiteAt:new Date(),checkoutAceiteUserId:user.id,
    checkoutAceiteNome:accepted?name:user.nome,
    checkoutAceiteVersao:CHECKOUT_ACEITE_VERSAO,
    checkoutAceiteHash:hash,checkoutAceiteIpHash:ipHash,
   }})
   if(updated.count!==1)return false
   await tx.atendimentoFichaEvento.create({data:{
    fichaId:id,actorId:user.id,
    acao:accepted?'checkout_tutor_aceitou':'checkout_tutor_recusou',
    resumo:accepted?'Tutor confirmou ciência da ficha de saída.':'Tutor registrou discordância da ficha de saída.',
   }})
   return true
  })
  if(!success)return reply({error:'Esta ficha já foi respondida. Atualize o histórico.'},409)
  return reply({ok:true,status:accepted?'aceito':'recusado',hash})
 }catch(e){
  console.error('[checkout-aceite] falha ao registrar decisão',e)
  return reply({error:'Não foi possível registrar sua resposta.'},503)
 }
}
