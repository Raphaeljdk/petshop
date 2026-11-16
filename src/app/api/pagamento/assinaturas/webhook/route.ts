import { NextRequest, NextResponse } from 'next/server'
import { validarAssinaturaWebhook, webhookSecretConfigurado } from '@/lib/mercado-pago-orders'
import { reconcileSubscriptionInvoice, reconcileSubscriptionStatus } from '@/lib/portal-subscriptions'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export async function POST(req:NextRequest) {
  // Fail closed in every environment; never accept unsigned activation.
  if(!webhookSecretConfigurado()) return NextResponse.json({error:'Webhook não configurado.'},{status:503})
  let payload:unknown
  try {payload=await req.json()} catch {return NextResponse.json({error:'Payload inválido.'},{status:400})}
  const body=payload as {type?:string;action?:string;data?:{id?:string|number}}
  const id=String(req.nextUrl.searchParams.get('data.id')||body?.data?.id||'')
  if(!id || id.length>70) return NextResponse.json({ok:true,ignored:true})
  if(!validarAssinaturaWebhook({
    xSignature:req.headers.get('x-signature'),xRequestId:req.headers.get('x-request-id'),dataId:id,
  }))return NextResponse.json({error:'Assinatura inválida.'},{status:401})
  const kind=String(body.type||req.nextUrl.searchParams.get('type')||'')
  try {
    if(kind==='subscription_authorized_payment')
      return NextResponse.json(await reconcileSubscriptionInvoice(id))
    if(kind==='subscription_preapproval')
      return NextResponse.json(await reconcileSubscriptionStatus(id))
    return NextResponse.json({ok:true,ignored:true})
  }catch(e){
    console.error('[portal/assinaturas/webhook] erro:',e)
    return NextResponse.json({error:'Não foi possível reconciliar a cobrança.'},{status:500})
  }
}
