import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { portalCliente } from '@/lib/portal-care'
import { experienceError, experienceBody } from '@/lib/customer-experience'
import { startSubscription, cancelSubscription, SubscriptionError } from '@/lib/portal-subscriptions'
import { db } from '@/lib/db'
export const dynamic='force-dynamic'
export const runtime='nodejs'
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('start'),requestId:z.string().min(1)}).strict(),
  z.object({action:z.literal('cancel'),requestId:z.string().min(1)}).strict(),
])
export async function POST(req:NextRequest) {
  try {
    const {clienteId,user}=await portalCliente()
    const data=schema.parse(await experienceBody(req))
    if(data.action==='start') {
      const email=user.cliente?.email || user.email
      const result=await startSubscription(data.requestId,clienteId,email)
      return NextResponse.json({url:result.url,status:'checkout_pendente'},{
        headers:{'Cache-Control':'private, no-store'},
      })
    }
    const result=await cancelSubscription(data.requestId,clienteId)
    return NextResponse.json(result)
  } catch(error) {
    if(error instanceof SubscriptionError) return NextResponse.json({error:error.message},{status:error.status})
    return experienceError(error)
  }
}
export async function GET() {
  try {
    const {clienteId}=await portalCliente()
    const requests=await db.portalCarePlanRequest.findMany({
      where:{clienteId},orderBy:{createdAt:'desc'},take:30,
      select:{id:true,status:true,providerCheckoutUrl:true,providerStatus:true,expiresAt:true,
        sessionsUsed:true,cancelAtPeriodEnd:true},
    })
    return NextResponse.json({requests},{headers:{'Cache-Control':'private, no-store'}})
  } catch(error){return experienceError(error)}
}
