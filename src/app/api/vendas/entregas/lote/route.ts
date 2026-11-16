import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { canCompleteLocalDelivery,LOCAL_DELIVERY_TYPES,LOCAL_DELIVERY_CHANNELS } from '@/lib/delivery-bulk-policy'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const requestSchema=z.object({
  ids:z.array(z.string().trim().min(5).max(120)).min(1).max(200),
  confirmed:z.literal(true),
}).strict()

export async function POST(req:NextRequest){
  const user=await getUsuarioLogado()
  if(!user)return NextResponse.json({error:'Não autenticado.'},{status:401})
  if(user.role!=='ADMIN')return NextResponse.json({error:'Acesso negado.'},{status:403})
  const origin=req.headers.get('origin')
  if((origin && origin!==new URL(req.url).origin) || req.headers.get('sec-fetch-site')==='cross-site')
    return NextResponse.json({error:'Origem não autorizada.'},{status:403})

  const parsed=requestSchema.safeParse(await req.json().catch(()=>null))
  if(!parsed.success)return NextResponse.json({error:'Selecione de 1 a 200 entregas e confirme a operação.'},{status:400})
  const ids=parsed.data.ids
  if(new Set(ids).size!==ids.length)
    return NextResponse.json({error:'Há pedidos repetidos na seleção.'},{status:400})

  try{
    const result=await db.$transaction(async tx=>{
      const orders=await tx.venda.findMany({where:{id:{in:ids}},
        select:{id:true,canal:true,status:true,tipoEntrega:true,statusEntrega:true}})
      if(orders.length!==ids.length||orders.some(o=>!canCompleteLocalDelivery(o)))
        return {error:'A lista mudou ou contém pedidos de marketplace, retiradas, cancelados ou já entregues.',status:409} as const
      const changed=await tx.venda.updateMany({
        where:{
          id:{in:ids},canal:{in:[...LOCAL_DELIVERY_CHANNELS]},
          status:'concluida',tipoEntrega:{in:[...LOCAL_DELIVERY_TYPES]},
          OR:[{statusEntrega:null},{statusEntrega:{in:['pendente','enviada']}}],
        },
        data:{statusEntrega:'entregue'},
      })
      if(changed.count!==ids.length)
        throw new Error('CONCURRENT_DELIVERY_CHANGE')
      const audit=await tx.entregaLoteAuditoria.create({data:{
        adminId:user.id,pedidoIds:ids,quantidade:changed.count,
      },select:{id:true}})
      return {delivered:changed.count,ids,auditId:audit.id} as const
    })
    if('error'in result)return NextResponse.json({error:result.error},{status:result.status})
    return NextResponse.json({success:true,...result},{
      headers:{'Cache-Control':'private,no-store'},
    })
  }catch(error){
    if(error instanceof Error&&error.message==='CONCURRENT_DELIVERY_CHANGE')
      return NextResponse.json({error:'Uma entrega mudou durante a operação. Atualize a lista antes de tentar novamente.'},{status:409})
    console.error('[entrega-lote] erro ao concluir:',error)
    return NextResponse.json({error:'Não foi possível concluir as entregas em lote.'},{status:503})
  }
}
