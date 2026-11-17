import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/auth-helpers'
import { experienceBody, experienceError } from '@/lib/customer-experience'

export async function GET() {
  try {
    if (!(await isAdmin()))
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    const [config, bookings, reviews, saved, restock, professionals] = await Promise.all([
      db.loyaltyConfig.findUnique({ where: { id: 'default' } }),
      db.bookingRequest.findMany({
        where: { status: { in: ['solicitado', 'confirmado'] } },
        orderBy: { desiredAt: 'asc' },
        take: 100,
        include: { cliente: { select: { nome: true } } },
      }),
      db.productReview.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 50,
        include: {
          produto: { select: { nome: true } },
          cliente: { select: { nome: true } },
        },
      }),
      db.customerPreference.count({ where: { favorite: true } }),
      db.customerPreference.count({ where: { restock: true } }),
      db.profissionalAgenda.findMany({where:{ativo:true},select:{id:true,nome:true},orderBy:{nome:'asc'}}),
    ])
    return NextResponse.json({ config, bookings, reviews, saved, restock, professionals })
  } catch (error) {
    return experienceError(error)
  }
}

const inputSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('config'),
      active: z.boolean(),
      spendCentsPerPoint: z.number().int().min(1).max(100000),
      rewardPoints: z.number().int().min(1).max(1000000),
      rewardCents: z.number().int().min(100).max(100000),
    })
    .strict(),
  z
    .object({
      action: z.literal('review'),
      id: z.string().min(1),
      hidden: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal('booking'),
      id: z.string().min(1),
      status: z.enum(['confirmado', 'recusado']),
      confirmedAt: z.string().datetime().optional(),
      confirmationRef: z.string().trim().max(150).optional(),
      reply: z.string().trim().min(3).max(1000),
      profissionalId:z.string().min(1).nullable().optional(),
    })
    .strict(),
])

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin()))
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    const data = inputSchema.parse(await experienceBody(req))
    if (data.action === 'config') {
      const { action: _, ...config } = data
      const result = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('loyalty-config'))`
        const current = await tx.loyaltyConfig.findUnique({
          where: { id: 'default' },
        })
        if (current && current.spendCentsPerPoint !== config.spendCentsPerPoint)
          return null
        return tx.loyaltyConfig.upsert({
          where: { id: 'default' },
          create: config,
          update: config,
        })
      })
      if (!result)
        return NextResponse.json(
          {
            error:
              'A taxa de acúmulo fica fixa após configurar, para preservar os pontos dos clientes.',
          },
          { status: 409 },
        )
      return NextResponse.json(result)
    }
    if (data.action === 'review')
      return NextResponse.json(
        await db.productReview.update({
          where: { id: data.id },
          data: { hidden: data.hidden },
        }),
      )
    if (
      data.status === 'confirmado' &&
      (!data.confirmedAt ||
        new Date(data.confirmedAt).getTime() <= Date.now() ||
        !data.confirmationRef)
    )
      return NextResponse.json(
        {
          error:
            'Registre primeiro na agenda da loja e informe a referência e o horário futuro confirmado.',
        },
        { status: 400 },
      )
    const result = await db.$transaction(async tx=>{
      const current=await tx.bookingRequest.findFirst({where:{id:data.id,status:'solicitado'},select:{id:true,profissionalId:true}})
      if(!current)return {error:'Solicitação já respondida ou cancelada.'}
      const chosen=data.profissionalId!==undefined?data.profissionalId:current.profissionalId
      if(data.status==='confirmado' && chosen) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'profissional-agenda:' + chosen}))`
        const worker=await tx.profissionalAgenda.findFirst({where:{id:chosen,ativo:true},select:{id:true}})
        if(!worker)return {error:'Profissional selecionado está inativo ou não existe.'}
        const begin=new Date(data.confirmedAt!)
        const blocked=await tx.agendaBloqueio.findFirst({where:{
          profissionalId:chosen,inicio:{lt:new Date(begin.getTime()+60*60_000)},fim:{gt:begin},
        },select:{id:true}})
        if(blocked)return {error:'O profissional está bloqueado neste horário (almoço, TaxDog ou outro compromisso).'}
      }
      const changed=await tx.bookingRequest.updateMany({
        where:{id:data.id,status:'solicitado'},
        data:{
          status:data.status,confirmedAt:data.status==='confirmado'?data.confirmedAt:null,
          confirmationRef:data.status==='confirmado'?data.confirmationRef:null,
          ...(data.profissionalId!==undefined?{profissionalId:data.profissionalId}:{}),
          reply:data.reply,
        },
      })
      return changed.count?{ok:true}:{error:'Solicitação já respondida ou cancelada.'}
    })
    if('error' in result)
      return NextResponse.json({error:result.error},{status:409})
    return NextResponse.json({ ok: true })
  } catch (error) {
    return experienceError(error)
  }
}
