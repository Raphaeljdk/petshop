import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { amazonConfirmedOrderById,amazonOrderItems,amazonSpApiConfig } from '@/lib/amazon-sp-api'
import { registerMarketplaceSale } from '@/lib/marketplace-sales'
import { z } from 'zod'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const input=z.object({orderId:z.string().regex(/^\d{3}-\d{7}-\d{7}$/),sellerId:z.string().min(1).max(100)}).strict()
export async function POST(req:NextRequest){
 const secret=process.env.AMAZON_ORDER_EVENTS_SECRET?.trim()
 const actual=req.headers.get('authorization')||''
 const expected='Bearer '+secret
 if(!secret||secret.length<32||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return NextResponse.json({error:'Não autorizado.'},{status:401})
 try{
  const raw=await req.text()
  if(raw.length>4096)return NextResponse.json({error:'Evento inválido.'},{status:400})
  const parsed=input.safeParse(JSON.parse(raw))
  if(!parsed.success)return NextResponse.json({error:'Evento inválido.'},{status:400})
  const {orderId,sellerId}=parsed.data
  if(amazonSpApiConfig().sellerId!==sellerId)return NextResponse.json({error:'Conta não autorizada.'},{status:403})
  const order=await amazonConfirmedOrderById(orderId)
  if(!order)return NextResponse.json({ok:true,ignored:true})
  const items=await amazonOrderItems(orderId)
  const result=await registerMarketplaceSale({channel:'amazon',orderId,createdAt:new Date(order.purchaseDate),total:order.total,buyerName:order.buyerName,items:items.map(i=>({externalProductId:i.asin,sku:i.sellerSku,title:i.title,quantity:i.quantity,unitPrice:i.unitPrice}))})
  return NextResponse.json({ok:true,created:result.created,status:result.status})
 }catch(e){console.error('[amazon/order-change] evento não processado',e instanceof Error?e.name:'erro');return NextResponse.json({error:'Falha ao processar evento.'},{status:503})}
}
