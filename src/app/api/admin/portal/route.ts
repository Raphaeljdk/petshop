import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { experienceBody, experienceError } from '@/lib/customer-experience'
import { imageData } from '@/lib/portal-care'
import { paidSaleWhere } from '@/lib/sales-policy'
import { awardReferralBySale } from '@/lib/portal-referral-awards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const articleForm = z.object({
  title:z.string().trim().min(6).max(150),
  category:z.enum(['Cuidados','Comportamento','Brinquedos','Bem-estar','Novidades']),
  summary:z.string().trim().min(15).max(320),
  body:z.string().trim().min(60).max(16000),
  imageUrl:z.union([z.string().url().max(1000).refine((s)=>s.startsWith('https://')),z.literal('')]).optional(),
  productId:z.string().max(100).nullable().optional(),
  published:z.boolean().default(false),
})
const actions = z.discriminatedUnion('action', [
  articleForm.extend({ action:z.literal('article-create') }).strict(),
  articleForm.extend({ action:z.literal('article-update'), id:z.string().min(1) }).strict(),
  z.object({ action:z.literal('article-unpublish'), id:z.string().min(1) }).strict(),
  z.object({ action:z.literal('plan-create'), title:z.string().trim().min(4).max(100),
    description:z.string().trim().min(10).max(500),
    sessions:z.number().int().min(1).max(30), durationDays:z.number().int().min(7).max(365),
    priceCents:z.number().int().min(100).max(1000000), active:z.boolean() }).strict(),
  z.object({ action:z.literal('plan-use'), requestId:z.string().min(1), processoId:z.string().min(1) }).strict(),
  z.object({ action:z.literal('plan-review'), id:z.string().min(1), status:z.enum(['recusado','ativo']),
    paymentVerified:z.boolean(), paymentReference:z.string().trim().min(4).max(150).optional() }).strict(),
  z.object({ action:z.literal('gift-review'), id:z.string().min(1),
    status:z.enum(['cancelado','aguardando_pagamento','pago']),
    paymentVerified:z.boolean(), paymentReference:z.string().trim().min(4).max(150).optional() }).strict(),
  z.object({ action:z.literal('referral-review'), id:z.string().min(1) }).strict(),
  z.object({action:z.literal('referral-config'),active:z.boolean(),
    awardCents:z.number().int().min(0).max(10000),minimumPurchaseCents:z.number().int().min(0).max(100000),
    validDays:z.number().int().min(1).max(365)}).strict(),
  z.object({ action:z.literal('grooming-photo'), processoId:z.string().min(1),
    kind:z.enum(['banho_antes','banho_depois']), imageData:imageData.refine((v)=>Boolean(v)),
    title:z.string().trim().min(2).max(100) }).strict(),
])

async function admin() {
  const user = await getUsuarioLogado()
  return user?.role === 'ADMIN'
}

export async function GET() {
  try {
    if (!await admin()) return NextResponse.json({ error:'Acesso negado.' }, { status:403 })
    const [articles,plans,requests,gifts,referrals,referralConfig] = await Promise.all([
      db.portalArticle.findMany({ orderBy:{ createdAt:'desc' }, take:100 }),
      db.portalCarePlan.findMany({ orderBy:{ createdAt:'desc' }, take:100 }),
      db.portalCarePlanRequest.findMany({ where:{ status:{ in:['solicitado','ativo'] } }, take:100,
        orderBy:{ createdAt:'desc' }, include:{ plan:{ select:{ title:true,sessions:true } } } }),
      db.portalGiftRequest.findMany({ where:{ status:{ in:['solicitado','aguardando_pagamento'] } }, take:100,
        orderBy:{ createdAt:'desc' } }),
      db.portalReferralClaim.findMany({ where:{ status:'aguardando_compra' }, take:100,
        orderBy:{ createdAt:'desc' } }),
      db.portalReferralConfig.findUnique({where:{id:'default'}}),
    ])
    // Diagnostic metadata only: never expose environment variable values, tokens or domains here.
    const mpConfig = await db.configuracaoPagamento.findFirst({
      select: { mercadoPagoAtivo:true, mercadoPagoAccessToken:true },
    })
    const paymentTokenConfigured = Boolean(mpConfig?.mercadoPagoAccessToken?.trim() || process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim())
    const emailConfigured = Boolean(process.env.RESEND_API_KEY?.trim() &&
      process.env.INVITATION_EMAIL_FROM?.trim())
    const whatsappConfigured = Boolean(process.env.META_WHATSAPP_ACCESS_TOKEN?.trim() &&
      process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() &&
      process.env.META_WHATSAPP_TEMPLATE_APPOINTMENT?.trim() &&
      /^v[0-9]+\\.[0-9]+$/.test(process.env.META_WHATSAPP_GRAPH_VERSION?.trim() || ''))
    const integrations = {
      subscriptions: {
        configured: paymentTokenConfigured && mpConfig?.mercadoPagoAtivo === true &&
          Boolean(process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim()) &&
          Boolean(process.env.APP_URL?.startsWith('https://') || process.env.NEXTAUTH_URL?.startsWith('https://')),
        validatedEndToEnd:false,
      },
      email: { configured: emailConfigured, domainVerified:false },
      whatsapp: { configured: whatsappConfigured, templateApproved:false },
      notifications: {
        enabled:process.env.PORTAL_NOTIFICATIONS_ENABLED === 'true',
        cronConfigured:Boolean(process.env.CRON_SECRET?.trim()),
      },
    }
    return NextResponse.json({ articles,plans,requests,gifts,referrals,referralConfig,integrations },
      { headers:{ 'Cache-Control':'private, no-store' } })
  } catch (error) { return experienceError(error) }
}

export async function POST(req: NextRequest) {
  try {
    if (!await admin()) return NextResponse.json({ error:'Acesso negado.' }, { status:403 })
    const staff = await getUsuarioLogado()
    if (!staff || staff.role !== 'ADMIN') return NextResponse.json({ error:'Acesso negado.' }, { status:403 })
    const data = actions.parse(await experienceBody(req, 250000))
    if (data.action === 'article-create' || data.action === 'article-update') {
      const article = {
        title:data.title, category:data.category, summary:data.summary, body:data.body,
        imageUrl:data.imageUrl || null, productId:data.productId || null, published:data.published,
      }
      if (article.productId && !await db.produto.findFirst({ where:{ id:article.productId, ativo:true }, select:{ id:true } }))
        return NextResponse.json({ error:'Produto relacionado não encontrado.' }, { status:400 })
      if (data.action === 'article-create') {
        const created = await db.portalArticle.create({ data:article })
        return NextResponse.json({ id:created.id }, { status:201 })
      }
      const updated = await db.portalArticle.updateMany({ where:{ id:data.id }, data:article })
      return NextResponse.json({ success:updated.count > 0 })
    }
    if (data.action === 'article-unpublish') {
      const updated = await db.portalArticle.updateMany({ where:{ id:data.id }, data:{ published:false } })
      return NextResponse.json({ success:updated.count > 0 })
    }
    if (data.action === 'plan-create') {
      const row = await db.portalCarePlan.create({ data:{
        title:data.title,description:data.description,sessions:data.sessions,
        durationDays:data.durationDays,priceCents:data.priceCents,active:data.active,
      } })
      return NextResponse.json({ id:row.id }, { status:201 })
    }
    if (data.action === 'plan-review') {
      if (data.status === 'ativo' && (!data.paymentVerified || !data.paymentReference))
        return NextResponse.json({ error:'Confirme manualmente o pagamento e a referência antes da ativação.' }, { status:400 })
      const target = await db.portalCarePlanRequest.findFirst({ where:{ id:data.id,status:'solicitado' },
        include:{plan:true} })
      if (!target) return NextResponse.json({ error:'Solicitação indisponível.' }, { status:404 })
      if (target.providerSubscriptionId && data.status==='ativo')
        return NextResponse.json({ error:'Assinatura Mercado Pago deve ser ativada somente por pagamento confirmado no webhook.' }, { status:409 })
      const start = new Date()
      const expires = new Date(start.getTime()+target.plan.durationDays*86400_000)
      await db.portalCarePlanRequest.updateMany({ where:{ id:target.id,status:'solicitado' },
        data:{ status:data.status, startsAt:data.status==='ativo'?start:null,
          expiresAt:data.status==='ativo'?expires:null,
          approvedAt:new Date(), approvedByUserId:staff.id,
          paymentReference:data.status==='ativo'?data.paymentReference:null } })
      return NextResponse.json({ success:true, note:'Registro administrativo; confira as evidências de pagamento fora deste painel.' })
    }
    if (data.action === 'plan-use') {
      const result = await db.$transaction(async (tx) => {
        const request = await tx.portalCarePlanRequest.findFirst({
          where:{ id:data.requestId,status:'ativo' },include:{ plan:true },
        })
        if (!request || !request.startsAt || !request.expiresAt)
          return { error:'Plano não está ativo.' }
        const service = await tx.processo.findFirst({
          where:{ id:data.processoId,status:'finalizado',petId:request.petKey,
            pet:{ clienteId:request.clienteId } },
          select:{ id:true, fimAtendimento:true },
        })
        if (!service?.fimAtendimento || service.fimAtendimento < request.startsAt ||
            service.fimAtendimento > request.expiresAt)
          return { error:'Atendimento concluído não corresponde ao pet ou ao período do plano.' }
        if (request.sessionsUsed >= request.plan.sessions)
          return { error:'Todas as sessões do plano já foram utilizadas.' }
        const updated = await tx.portalCarePlanRequest.updateMany({
          where:{ id:request.id,sessionsUsed:{ lt:request.plan.sessions },status:'ativo' },
          data:{ sessionsUsed:{ increment:1 } },
        })
        if (!updated.count) return { error:'Sessões esgotadas.' }
        await tx.portalCarePlanUse.create({data:{ requestId:request.id,processoId:service.id }})
        return { success:true }
      },{ isolationLevel:'Serializable' })
      if ('error' in result) return NextResponse.json(result,{status:409})
      return NextResponse.json({success:true,note:'Sessão abatida com vínculo ao atendimento concluído.'})
    }
    if (data.action === 'gift-review') {
      if (data.status === 'pago' && (!data.paymentVerified || !data.paymentReference))
        return NextResponse.json({ error:'A emissão exige pagamento verificado com referência.' }, { status:400 })
      const voucher = await db.portalGiftRequest.findFirst({ where:{ id:data.id,status:{ in:['solicitado','aguardando_pagamento'] } } })
      if (!voucher) return NextResponse.json({ error:'Solicitação indisponível.' }, { status:404 })
      const code = data.status==='pago'?'MP-PRES-'+randomBytes(7).toString('hex').toUpperCase():null
      await db.portalGiftRequest.updateMany({
        where:{ id:voucher.id, status:{ in:['solicitado','aguardando_pagamento'] } },
        data:{ status:data.status, paidAt:data.status==='pago'?new Date():null, voucherCode:code,
          balanceCents:data.status==='pago'?voucher.amountCents:0,
          paymentReference:data.status==='pago'?data.paymentReference:null,approvedByUserId:staff.id },
      })
      return NextResponse.json({ success:true, note:data.status==='pago'?'Código gerado após verificação manual. O resgate no checkout ainda precisa de integração.':'Status registrado.' })
    }
    if(data.action==='referral-config'){
      await db.portalReferralConfig.upsert({where:{id:'default'},
        create:{id:'default',active:data.active,awardCents:data.awardCents,
          minimumPurchaseCents:data.minimumPurchaseCents,validDays:data.validDays},
        update:{active:data.active,awardCents:data.awardCents,
          minimumPurchaseCents:data.minimumPurchaseCents,validDays:data.validDays}})
      return NextResponse.json({success:true,note:'Regras de indicação atualizadas.'})
    }
    if(data.action==='referral-review') {
      const claim=await db.portalReferralClaim.findFirst({where:{id:data.id,status:'aguardando_compra'}})
      if(!claim)return NextResponse.json({error:'Indicação indisponível.'},{status:404})
      const eligible=await db.venda.findFirst({where:{...paidSaleWhere,clienteId:claim.invitedId,
        createdAt:{gte:claim.createdAt}},select:{id:true},orderBy:{createdAt:'asc'}})
      if(!eligible)return NextResponse.json({error:'Nenhuma compra paga elegível.'},{status:409})
      const result=await awardReferralBySale(eligible.id)
      if(!result.awarded)return NextResponse.json({error:'Regras de benefício inativas, valor mínimo não atingido ou indicação inelegível.'},{status:409})
      return NextResponse.json({success:true,note:'Cupom pessoal emitido para o indicador.'})
    }
    if (data.action === 'grooming-photo') {
      const process = await db.processo.findUnique({ where:{ id:data.processoId },
        select:{ petId:true, pet:{ select:{ clienteId:true } } } })
      if (!process) return NextResponse.json({ error:'Atendimento não encontrado.' }, { status:404 })
      const prefs = await db.portalClientPreferences.findUnique({ where:{ clienteId:process.pet.clienteId } })
      if (!prefs?.groomingPhotoConsent)
        return NextResponse.json({ error:'O tutor ainda não autorizou fotos do atendimento.' }, { status:409 })
      const count = await db.portalPetMemory.count({ where:{ processoId:data.processoId, kind:data.kind } })
      if (count >= 2) return NextResponse.json({ error:'Limite de duas fotos por etapa e atendimento.' }, { status:409 })
      const created = await db.portalPetMemory.create({ data:{
        clienteId:process.pet.clienteId, petKey:process.petId, processoId:data.processoId,
        kind:data.kind,title:data.title,imageData:data.imageData,createdByAdmin:true,
      } })
      return NextResponse.json({ id:created.id }, { status:201 })
    }
    return NextResponse.json({ error:'Ação inválida.' }, { status:400 })
  } catch (error) { return experienceError(error) }
}
