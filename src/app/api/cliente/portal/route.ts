import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { experienceBody, experienceError } from '@/lib/customer-experience'
import { portalCliente, ownsPet, cleanEmail, imageData, petKeySchema, portalDate, bodyText, recommendationRank } from '@/lib/portal-care'
import { getZettaAnimalsByClient } from '@/lib/zetta-client'
import { artigoDeDiario } from '@/lib/portal-pet-blog'
import { normalizarTelefonePresente } from '@/lib/portal-gift-phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('favorite'), articleId: z.string().min(1), saved: z.boolean() }).strict(),
  z.object({ action: z.literal('memory'), petKey: petKeySchema,
    kind: z.enum(['diario', 'vacina_documento']), title: z.string().trim().min(2).max(120),
    notes: bodyText, imageData, weightKg: z.number().min(0.1).max(200).nullable().optional(),
    eventAt: portalDate, nextAt: portalDate,
    autorizarBlog: z.boolean().optional() }).strict(),
  z.object({ action: z.literal('blog-consent'), id: z.string().min(1), accepted: z.boolean() }).strict(),
  z.object({ action: z.literal('remove-memory'), id: z.string().min(1) }).strict(),
  z.object({ action: z.literal('preferences'), remindersInApp: z.boolean(),
    remindersEmail: z.boolean(), remindersWhatsapp: z.boolean(),
    marketingEmail: z.boolean(), marketingWhatsapp: z.boolean(),
    groomingPhotoConsent: z.boolean() }).strict(),
  z.object({ action: z.literal('plan-request'), planId: z.string().min(1), petKey: petKeySchema }).strict(),
  z.object({ action: z.literal('referral-code') }).strict(),
  z.object({ action: z.literal('referral-claim'), code: z.string().trim().min(4).max(32) }).strict(),
  z.object({ action: z.literal('gift-request'),
    recipientName: z.string().trim().min(2).max(120),
    recipientPhone: z.string().trim().min(10, 'Informe o telefone do presenteado.').max(24)
      .refine((value) => Boolean(normalizarTelefonePresente(value)), 'Informe um telefone brasileiro válido com DDD.'),
    message: z.string().trim().max(500).optional(),
    amountCents: z.number().int().min(2000).max(50000) }).strict(),
  z.object({ action: z.literal('family-invite'), petKey: petKeySchema, email: z.string().email().max(200) }).strict(),
  z.object({ action: z.literal('family-response'), id: z.string().min(1), accepted: z.boolean() }).strict(),
  z.object({ action: z.literal('family-revoke'), id: z.string().min(1) }).strict(),
  z.object({ action: z.literal('family-approve'), id: z.string().min(1) }).strict(),
])

export async function GET() {
  try {
    const { user, clienteId } = await portalCliente()
    const [articles, favorites, memories, preferences, plans, requests,
      referral, claims, gifts, outgoing, incoming, localPets, products, likedProducts] = await Promise.all([
      db.portalArticle.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' },
        take: 40, select: { id:true, title:true, category:true, summary:true, body:true, imageUrl:true, productId:true, createdAt:true } }),
      db.portalArticleFavorite.findMany({ where: { clienteId }, select: { articleId:true } }),
      db.portalPetMemory.findMany({ where: { clienteId }, orderBy: { eventAt: 'desc' }, take: 60 }),
      db.portalClientPreferences.findUnique({ where: { clienteId } }),
      db.portalCarePlan.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' }, take: 30 }),
      db.portalCarePlanRequest.findMany({ where: { clienteId }, orderBy: { createdAt: 'desc' }, take: 30,
        include: { plan: { select: { title:true, sessions:true, priceCents:true } } } }),
      db.portalReferral.findUnique({ where: { clienteId } }),
      db.portalReferralClaim.findMany({ where: { inviterId: clienteId }, orderBy: { createdAt: 'desc' }, take: 30,
        select: { id:true, status:true, createdAt:true, rewardCouponId:true } }),
      db.portalGiftRequest.findMany({ where: { clienteId }, orderBy: { createdAt:'desc' }, take: 25 }),
      db.portalPetFamilyInvite.findMany({ where: { ownerClienteId: clienteId }, orderBy: { createdAt: 'desc' }, take: 25 }),
      db.portalPetFamilyInvite.findMany({ where: { recipientEmail: cleanEmail(user.email) },
        orderBy: { createdAt: 'desc' }, take: 25 }),
      db.pet.findMany({ where: { clienteId, ativo: true }, select: { id:true, nome:true, especie:true, porte:true, nascimento:true, fotoUrl:true, raca:true } }),
      db.produto.findMany({ where: { ativo:true, estoque: { gt:0 } },
        select: { id:true, nome:true, categoria:true, preco:true, precoPromo:true, imageUrl:true }, take: 75 }),
      db.customerPreference.findMany({ where:{ clienteId, favorite:true },take:30,
        select:{ produto:{select:{ categoria:true,nome:true }} } }),
    ])
    const publishedMemories = await db.portalPetMemory.findMany({
      where: { kind:'diario', createdByAdmin:false, blogStatus:'publicado', blogConsentAt:{not:null} },
      select: {
        id:true, kind:true, title:true, notes:true, imageData:true, createdAt:true, eventAt:true,
        blogConsentAt:true, blogStatus:true, createdByAdmin:true,
      },
      orderBy:{createdAt:'desc'},take:24,
    })
    const historias = publishedMemories.map(artigoDeDiario).filter((story) => story !== null)
    const pets = localPets.map((p) => ({ ...p, origem:'local' as const }))
    if (user.siggmaCliCod) {
      try {
        const linked = await getZettaAnimalsByClient(user.siggmaCliCod)
        for (const pet of linked) pets.push({
          id: 'zetta:' + pet.id, nome:pet.nome || 'Pet', especie:pet.especie || 'Pet',
          porte:null, nascimento:null, fotoUrl:null, raca:null, origem:'local' as const,
        })
      } catch { /* A integração externa não deve derrubar o conteúdo local. */ }
    }
    const couponIds=claims.flatMap((c)=>c.rewardCouponId?[c.rewardCouponId]:[])
    const rewardCoupons=await db.cupom.findMany({where:{id:{in:couponIds},ativo:true},
      select:{codigo:true,descricao:true,valor:true,fimEm:true}})
    const notifications=await db.portalMessageDelivery.findMany({where:{
      clienteId,channel:'app',status:'enviado'},
      select:{id:true,text:true,sentAt:true},orderBy:{createdAt:'desc'},take:15})
    const documents=await db.portalPetDocument.findMany({where:{clienteId},
      select:{id:true,petKey:true,title:true,fileName:true,sizeBytes:true,createdAt:true},
      orderBy:{createdAt:'desc'},take:40})
    const species = pets[0]?.especie || ''
    const size = pets[0]?.porte || ''
    const birthday = pets[0]?.nascimento ? new Date(pets[0].nascimento) : null
    const age = birthday && !Number.isNaN(birthday.getTime())
      ? Math.max(0, Math.floor((Date.now()-birthday.getTime())/31_557_600_000)) : null
    const favoriteCategories = new Set(likedProducts.map((p)=>p.produto.categoria))
    const recommendations = products
      .map((p) => ({ ...p, score:recommendationRank(p.nome,p.categoria,species,size,age)
        + (favoriteCategories.has(p.categoria)?2:0) }))
      .filter((p) => p.score > 0).sort((a,b) => b.score-a.score).slice(0,8)
      .map(({ score, ...p }) => p)
    const shares = await Promise.all(incoming.filter((i) => i.status === 'aceito' && i.recipientClienteId === clienteId)
      .map(async (invite) => {
        const pet = await db.pet.findFirst({ where: { id:invite.petKey, clienteId:invite.ownerClienteId, ativo:true },
          select:{ id:true, nome:true, especie:true } })
        if (!pet) return null
        const agenda = await db.agendamento.findMany({ where: { petId:pet.id, clienteId:invite.ownerClienteId,
          dataHora:{ gte:new Date() }, status:{ in:['agendado','confirmado'] } },
          select: { id:true, dataHora:true, servico:true, status:true }, orderBy:{ dataHora:'asc' }, take:3 })
        return { pet, agenda, inviteId:invite.id }
      }))
    return NextResponse.json({
      articles:[...articles, ...historias].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()), favorites:favorites.map((x) => x.articleId),
      memories, preferences: preferences || {
        remindersInApp:true, remindersEmail:false, remindersWhatsapp:false,
        marketingEmail:false, marketingWhatsapp:false, groomingPhotoConsent:false,
      },
      features: {
        subscriptionsEnabled:process.env.PORTAL_SUBSCRIPTIONS_ENABLED === 'true',
        giftRedemptionEnabled:process.env.PORTAL_GIFT_REDEMPTION_ENABLED === 'true',
      },
      pets, recommendations, plans, requests, rewardCoupons,notifications,documents,
      referralCode:referral?.code || null, referrals:claims, gifts,
      outgoing, incoming:incoming.map((i) => ({ id:i.id, status:i.status, petKey:i.petKey, createdAt:i.createdAt })),
      sharedPets:shares.filter((x) => x !== null),
    }, { headers: { 'Cache-Control':'private, no-store' } })
  } catch (error) { return experienceError(error) }
}

export async function POST(req: NextRequest) {
  try {
    const { user, clienteId } = await portalCliente()
    const data = actionSchema.parse(await experienceBody(req, 245000))
    if (data.action === 'favorite') {
      const article = await db.portalArticle.findFirst({ where: { id:data.articleId, published:true }, select: { id:true } })
      if (!article) return NextResponse.json({ error:'Artigo indisponível.' }, { status:404 })
      const key = { articleId_clienteId: { articleId:data.articleId, clienteId } }
      if (data.saved) await db.portalArticleFavorite.upsert({ where:key,
        create:{ articleId:data.articleId, clienteId }, update:{} })
      else await db.portalArticleFavorite.deleteMany({ where:{ articleId:data.articleId, clienteId } })
      return NextResponse.json({ success:true })
    }
    if (data.action === 'memory') {
      if (!await ownsPet(user,data.petKey))
        return NextResponse.json({ error:'Pet não encontrado na sua conta.' }, { status:404 })
      if (data.kind !== 'diario' && data.autorizarBlog)
        return NextResponse.json({error:'Somente anotações do diário podem ser enviadas para o blog.'},{status:400})
      if (data.kind === 'vacina_documento' && !data.imageData)
        return NextResponse.json({ error:'Anexe uma foto do comprovante para registrar o documento.' }, { status:400 })
      const count = await db.portalPetMemory.count({where:{clienteId}})
      if (count >= 100) return NextResponse.json({error:'Limite de 100 registros atingido. Exclua registros antigos para continuar.'},{status:409})
      if (data.imageData && await db.portalPetMemory.count({where:{clienteId,imageData:{not:null}}}) >= 30)
        return NextResponse.json({error:'Limite de 30 fotos atingido para proteger o armazenamento.'},{status:409})
      const item = await db.portalPetMemory.create({ data: {
        clienteId, petKey:data.petKey, kind:data.kind, title:data.title,
        notes:data.notes || null, imageData:data.imageData || null,
        weightKg:data.weightKg ?? null,
        eventAt:data.eventAt ? new Date(data.eventAt) : new Date(),
        nextAt:data.nextAt ? new Date(data.nextAt) : null,
        blogConsentAt:data.kind==='diario'&&data.autorizarBlog ? new Date() : null,
        blogStatus:data.kind==='diario'&&data.autorizarBlog ? 'pendente' : 'privado',
      } })
      return NextResponse.json({
        id:item.id, note:data.kind==='diario'&&data.autorizarBlog
          ? 'Diário salvo. Sua história foi enviada para revisão e ainda não aparece no blog.'
          : 'Registro adicionado ao diário particular.',
      }, { status:201 })
    }
    if (data.action === 'blog-consent') {
      const record=await db.portalPetMemory.findFirst({
        where:{id:data.id,clienteId,kind:'diario',createdByAdmin:false},
        select:{id:true,blogStatus:true,blogConsentAt:true},
      })
      if(!record) return NextResponse.json({error:'Diário não encontrado na sua conta.'},{status:404})
      if (data.accepted && record.blogStatus==='publicado')
        return NextResponse.json({success:true,note:'Esta história já está publicada no blog.'})
      const result=await db.portalPetMemory.updateMany({
        where:{id:record.id,clienteId,kind:'diario',createdByAdmin:false},
        data:data.accepted
          ? {blogConsentAt:new Date(),blogStatus:'pendente',blogReviewedAt:null,blogReviewedBy:null}
          : {blogConsentAt:null,blogStatus:'revogado'},
      })
      return NextResponse.json({success:result.count>0,note:data.accepted
        ? 'Autorização registrada. A história ficará aguardando aprovação da equipe.'
        : 'Autorização retirada. A história não aparecerá mais no blog.'})
    }
    if (data.action === 'remove-memory') {
      const result = await db.portalPetMemory.deleteMany({ where: { id:data.id, clienteId, createdByAdmin:false } })
      return NextResponse.json({ success:result.count > 0 })
    }
    if (data.action === 'preferences') {
      await db.$transaction(async (tx) => {
        await tx.portalClientPreferences.upsert({ where: { clienteId },
          create: { clienteId, remindersInApp:data.remindersInApp, remindersEmail:data.remindersEmail,
            remindersWhatsapp:data.remindersWhatsapp, marketingEmail:data.marketingEmail,
            marketingWhatsapp:data.marketingWhatsapp, groomingPhotoConsent:data.groomingPhotoConsent },
          update: { remindersInApp:data.remindersInApp, remindersEmail:data.remindersEmail,
            remindersWhatsapp:data.remindersWhatsapp, marketingEmail:data.marketingEmail,
            marketingWhatsapp:data.marketingWhatsapp, groomingPhotoConsent:data.groomingPhotoConsent },
        })
        // Revogação apaga as fotos anexadas pela equipe: não manter dados após retirada do consentimento.
        if (!data.groomingPhotoConsent) await tx.portalPetMemory.deleteMany({
          where: { clienteId, createdByAdmin:true, kind:{ in:['banho_antes','banho_depois'] } },
        })
      })
      return NextResponse.json({ success:true,
        note:data.groomingPhotoConsent
          ? 'Consentimento registrado. Canais externos dependem de integração habilitada.'
          : 'Preferências salvas. Fotos da equipe removidas quando a autorização é retirada.' })
    }
    if (data.action === 'plan-request') {
      if (!await ownsPet(user,data.petKey)) return NextResponse.json({ error:'Pet não encontrado.' }, { status:404 })
      const plan = await db.portalCarePlan.findFirst({ where: { id:data.planId, active:true } })
      if (!plan) return NextResponse.json({ error:'Plano indisponível.' }, { status:404 })
      const existing = await db.portalCarePlanRequest.findFirst({ where: {
        clienteId, petKey:data.petKey, status: { in:['solicitado','ativo'] },
      } })
      if (existing) return NextResponse.json({ error:'Já existe uma solicitação ou plano em andamento para este pet.' }, { status:409 })
      await db.portalCarePlanRequest.create({ data: { clienteId, petKey:data.petKey, planId:data.planId } })
      return NextResponse.json({ success:true, note:'Solicitação recebida; nenhuma cobrança foi efetuada.' }, { status:201 })
    }
    if (data.action === 'referral-code') {
      const previous = await db.portalReferral.findUnique({ where:{ clienteId } })
      if (previous) return NextResponse.json({ code:previous.code })
      const created = await db.portalReferral.create({
        data:{ clienteId, code:'MP'+randomBytes(7).toString('hex').toUpperCase() },
      })
      return NextResponse.json({ code:created.code }, { status:201 })
    }
    if (data.action === 'referral-claim') {
      const code = data.code.toUpperCase()
      const referral = await db.portalReferral.findUnique({ where:{ code } })
      if (!referral || referral.clienteId === clienteId)
        return NextResponse.json({ error:'Código inválido.' }, { status:400 })
      const existingSale = await db.venda.findFirst({ where:{ clienteId,
        status:{ in:['concluida','paga','enviada'] } }, select:{ id:true } })
      if (existingSale) return NextResponse.json({ error:'Indicações disponíveis somente antes da primeira compra.' }, { status:409 })
      const claim = await db.portalReferralClaim.create({ data: {
        inviterId:referral.clienteId, invitedId:clienteId, code,
      } })
      return NextResponse.json({ id:claim.id, status:claim.status }, { status:201 })
    }
    if (data.action === 'gift-request') {
      const pendingGifts = await db.portalGiftRequest.count({where:{
        clienteId,status:{in:['solicitado','aguardando_pagamento']},
      }})
      if (pendingGifts >= 5) return NextResponse.json({error:'Limite de 5 solicitações pendentes. Aguarde a análise da loja.'},{status:409})
      await db.portalGiftRequest.create({ data: {
        clienteId, recipientName:data.recipientName,
        recipientPhone:normalizarTelefonePresente(data.recipientPhone)!,
        amountCents:data.amountCents, message:data.message || null,
      } })
      return NextResponse.json({ success:true, note:'Pedido recebido. O voucher só será emitido após aprovação e pagamento confirmado.' }, { status:201 })
    }
    if (data.action === 'family-invite') {
      if (!await ownsPet(user,data.petKey))
        return NextResponse.json({ error:'Pet não encontrado.' }, { status:404 })
      const email = cleanEmail(data.email)
      if (email === cleanEmail(user.email)) return NextResponse.json({ error:'Não é possível convidar a própria conta.' }, { status:400 })
      const activeInvites = await db.portalPetFamilyInvite.count({where:{
        ownerClienteId:clienteId,petKey:data.petKey,
        status:{in:['pendente','aguardando_aprovacao','aceito']},
      }})
      if (activeInvites >= 5) return NextResponse.json({error:'No máximo cinco convites ativos por pet.'},{status:409})
      await db.portalPetFamilyInvite.upsert({
        where: { ownerClienteId_petKey_recipientEmail: { ownerClienteId:clienteId, petKey:data.petKey, recipientEmail:email } },
        create: { ownerClienteId:clienteId, petKey:data.petKey, recipientEmail:email },
        update: { status:'pendente', recipientClienteId:null, respondedAt:null },
      })
      return NextResponse.json({ success:true, note:'Convite registrado. A pessoa deve entrar com esse e-mail para aceitar.' })
    }
    if (data.action === 'family-response') {
      const updated = await db.portalPetFamilyInvite.updateMany({ where:{
        id:data.id, recipientEmail:cleanEmail(user.email), status:'pendente',
        ownerClienteId: { not:clienteId },
      }, data: { status:data.accepted ? 'aguardando_aprovacao':'recusado',
        recipientClienteId:data.accepted ? clienteId:null, respondedAt:new Date() } })
      if (!updated.count) return NextResponse.json({ error:'Convite não encontrado.' }, { status:404 })
      return NextResponse.json({ success:true })
    }
    if (data.action === 'family-approve') {
      const changed = await db.portalPetFamilyInvite.updateMany({ where: {
        id:data.id, ownerClienteId:clienteId,status:'aguardando_aprovacao',
        recipientClienteId:{ not:null },
      }, data:{ status:'aceito',respondedAt:new Date() } })
      if (!changed.count) return NextResponse.json({ error:'Aceite pendente não encontrado.' }, { status:404 })
      return NextResponse.json({ success:true, note:'Acesso à agenda compartilhada foi autorizado por você.' })
    }
    if (data.action === 'family-revoke') {
      const updated = await db.portalPetFamilyInvite.updateMany({ where:{ id:data.id, ownerClienteId:clienteId },
        data:{ status:'revogado', recipientClienteId:null, respondedAt:new Date() } })
      return NextResponse.json({ success:updated.count > 0 })
    }
    return NextResponse.json({ error:'Ação inválida.' }, { status:400 })
  } catch (error) { return experienceError(error) }
}
