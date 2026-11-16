import { db } from '@/lib/db'
import { getOuCriarConfigPagamento } from '@/lib/mercado-pago'
import { Prisma } from '@prisma/client'

export class SubscriptionError extends Error {
  constructor(message:string,public status=409){super(message)}
}
export async function subscriptionGateway(path:string,init:RequestInit={}) {
  const conf=await getOuCriarConfigPagamento()
  const token=conf.mercadoPagoAccessToken?.trim() || process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim()
  if(!conf.mercadoPagoAtivo || !token || token.includes('fallback') || token.includes('xxxxxxxx'))
    throw new SubscriptionError('Assinaturas indisponíveis. Configure credenciais reais do Mercado Pago.',503)
  const response=await fetch('https://api.mercadopago.com'+path,{
    ...init,
    headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json',...init.headers},
    cache:'no-store',signal:AbortSignal.timeout(12000),
  })
  const json=await response.json().catch(()=>null)
  if(!response.ok) throw new SubscriptionError('Mercado Pago não confirmou a operação. Verifique a integração.',502)
  return json
}
function origin() {
  const raw=process.env.APP_URL?.trim()||process.env.NEXTAUTH_URL?.trim()||''
  let url:URL
  try {url=new URL(raw)} catch {throw new SubscriptionError('APP_URL precisa ser HTTPS para cobranças recorrentes.',503)}
  if(url.protocol!=='https:'||url.username||url.password) throw new SubscriptionError('APP_URL precisa ser HTTPS.',503)
  return url.origin
}
export function trustedCheckoutLink(raw:unknown) {
  try {
    const url=new URL(String(raw||''))
    if(url.protocol!=='https:'||!(url.hostname==='mercadopago.com.br'||url.hostname.endsWith('.mercadopago.com.br')||
      url.hostname==='mercadopago.com'||url.hostname.endsWith('.mercadopago.com'))) return null
    return url.href
  } catch {return null}
}
export async function startSubscription(requestId:string,clienteId:string,email:string) {
  if(process.env.PORTAL_SUBSCRIPTIONS_ENABLED!=='true')
    throw new SubscriptionError('Assinaturas aguardam homologação; a cobrança ainda não está ativada.',503)
  if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new SubscriptionError('Cadastre um e-mail válido.',400)
  const request=await db.portalCarePlanRequest.findFirst({where:{id:requestId,clienteId},include:{plan:true}})
  if(!request||!['solicitado','checkout_pendente'].includes(request.status))
    throw new SubscriptionError('Solicitação indisponível ou já ativa.',409)
  if(!request.plan.active || request.plan.durationDays!==30 || request.plan.priceCents<100)
    throw new SubscriptionError('Somente planos mensais (30 dias de referência) estão disponíveis para recorrência.',409)
  if(request.providerSubscriptionId && request.providerCheckoutUrl)
    return {url:request.providerCheckoutUrl,providerId:request.providerSubscriptionId}
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))','subscription:'+requestId)
    const latest=await tx.portalCarePlanRequest.findUnique({where:{id:requestId}})
    if(latest?.providerSubscriptionId) {
      if(!latest.providerCheckoutUrl) throw new SubscriptionError('Assinatura existente. Consulte o suporte para recuperar o link.',409)
      return {url:latest.providerCheckoutUrl,providerId:latest.providerSubscriptionId}
    }
    const created=await subscriptionGateway('/preapproval',{method:'POST',body:JSON.stringify({
      reason:'Matilha Prado - '+request.plan.title,external_reference:requestId,payer_email:email,
      auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:request.plan.priceCents/100,currency_id:'BRL'},
      back_url:origin()+'/',status:'pending',
    })})
    const url=trustedCheckoutLink(created?.init_point)
    if(!created?.id || !url) throw new SubscriptionError('O provedor não retornou um link de assinatura válido.',502)
    await tx.portalCarePlanRequest.update({where:{id:requestId},data:{
      status:'checkout_pendente',providerSubscriptionId:String(created.id),providerCheckoutUrl:url,
      providerStatus:String(created.status||'pending'),providerSyncedAt:new Date(),
    }})
    return {url,providerId:String(created.id)}
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:25000})
}
export async function cancelSubscription(requestId:string,clienteId:string) {
  const row=await db.portalCarePlanRequest.findFirst({where:{id:requestId,clienteId}})
  if(!row?.providerSubscriptionId) throw new SubscriptionError('Assinatura não encontrada.',404)
  const updated=await subscriptionGateway('/preapproval/'+encodeURIComponent(row.providerSubscriptionId),
    {method:'PUT',body:JSON.stringify({status:'cancelled'})})
  if(!['cancelled','canceled'].includes(String(updated?.status))) throw new SubscriptionError('O provedor não confirmou o cancelamento.',502)
  await db.portalCarePlanRequest.updateMany({where:{id:requestId,clienteId},data:{
    cancelAtPeriodEnd:true,providerStatus:'cancelled',providerSyncedAt:new Date(),
    status:row.expiresAt && row.expiresAt>new Date() ?'ativo':'cancelado',
  }})
  return {success:true}
}
function nextMonth(now:Date) {
  const d=new Date(now)
  const day=d.getUTCDate()
  d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1)
  const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()
  d.setUTCDate(Math.min(day,max))
  return d
}
export async function reconcileSubscriptionInvoice(invoiceId:string) {
  if(!/^\d{1,30}$/.test(invoiceId)) throw new SubscriptionError('Fatura inválida.',400)
  const invoice=await subscriptionGateway('/authorized_payments/'+invoiceId)
  const subId=String(invoice?.preapproval_id||'')
  if(!subId || !invoice?.payment?.id) return {ok:true,ignored:true}
  const row=await db.portalCarePlanRequest.findUnique({where:{providerSubscriptionId:subId},include:{plan:true}})
  if(!row) return {ok:true,ignored:true}
  const official=await subscriptionGateway('/preapproval/'+encodeURIComponent(subId))
  if(String(official?.id)!==subId || String(official?.external_reference)!==row.id)
    throw new SubscriptionError('Assinatura não corresponde ao pedido.',409)
  const amount=Math.round(Number(invoice.transaction_amount)*100)
  const approved=String(invoice.payment.status)==='approved' && String(invoice.currency_id)==='BRL' &&
    Number.isSafeInteger(amount) && amount===row.plan.priceCents
  if(!approved) return {ok:true,paid:false}
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))','subscription:'+row.id)
    const exists=await tx.portalCarePlanPayment.findUnique({where:{providerPaymentId:invoiceId}})
    if(exists) return {ok:true,duplicate:true}
    const latest=await tx.portalCarePlanRequest.findUnique({where:{id:row.id}})
    if(!latest) return {ok:true,ignored:true}
    const paidAt=new Date(invoice.debit_date||invoice.date_created||Date.now())
    if(Number.isNaN(paidAt.getTime())) throw new SubscriptionError('Data da fatura inválida.')
    await tx.portalCarePlanPayment.create({data:{
      requestId:row.id,providerPaymentId:invoiceId,status:'approved',amountCents:amount,paidAt,
    }})
    const newer=latest.expiresAt && latest.expiresAt>paidAt ? latest.expiresAt : paidAt
    const expires=nextMonth(newer)
    await tx.portalCarePlanRequest.update({where:{id:row.id},data:{
      status:'ativo',startsAt:latest.startsAt||paidAt,expiresAt:expires,
      sessionsUsed:0,providerStatus:String(official.status||'authorized'),providerSyncedAt:new Date(),
      paymentReference:'MP: '+invoiceId,approvedAt:paidAt,
    }})
    return {ok:true,paid:true,requestId:row.id}
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
}
export async function reconcileSubscriptionStatus(id:string) {
  const official=await subscriptionGateway('/preapproval/'+encodeURIComponent(id))
  const request=await db.portalCarePlanRequest.findUnique({where:{providerSubscriptionId:id}})
  if(!request || String(official?.external_reference)!==request.id) return {ok:true,ignored:true}
  const status=String(official.status||'')
  await db.portalCarePlanRequest.updateMany({where:{id:request.id},data:{
    providerStatus:status,providerSyncedAt:new Date(),
    ...(status==='cancelled'||status==='paused' ?{
      status:request.expiresAt && request.expiresAt>new Date() ? 'ativo':'cancelado',
      cancelAtPeriodEnd:status==='cancelled',
    }:{})
  }})
  return {ok:true,status}
}
