import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { experienceBody, experienceError } from '@/lib/customer-experience'
import { assertSameOrigin } from '@/lib/auth-http'
import { selecionarReservaAutomatica } from '@/lib/catalogo-agenda-publica'

import { inferirCategoriaAgenda } from '@/lib/agenda-servicos'
import { horarioNoIntervalo } from '@/lib/agenda-horarios-portal'

export async function GET() {
  try {
    const user = await getUsuarioLogado()
    if (!user?.cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json(
      await db.bookingRequest.findMany({
        where: { clienteId: user.cliente.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include:{pagamentoVenda:{select:{id:true,total:true,status:true,mercadoPagoStatus:true}}},
      }),
    )
  } catch (error) {
    return experienceError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req)
    const user = await getUsuarioLogado()
    if (!user?.cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const input = z
      .object({
        petKey: z.string().min(1).max(100),
        service: z.string().trim().min(3).max(120),
        desiredAt: z.string().datetime(),
        notes: z.string().trim().max(1000).optional(),
        gravataNome: z.string().trim().min(1).max(80).optional(),
        gravataIdeia: z.string().trim().max(400).optional(),
        gravataFoto: z.string().max(400000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).optional(),
      })
      .strict().refine(v=>!v.gravataIdeia||!!(v.gravataFoto||v.gravataNome),'Informe o nome ou a foto da personalização.')
      .parse(await experienceBody(req, 420000))
    const desired = new Date(input.desiredAt)
    if (
      desired.getTime() <= Date.now() ||
      desired.getTime() > Date.now() + 180 * 86400000
    )
      return NextResponse.json(
        { error: 'Escolha uma data futura nos próximos seis meses.' },
        { status: 400 },
      )
    if(!horarioNoIntervalo(desired))return NextResponse.json({error:'Escolha um horário em intervalos de 10 minutos.'},{status:400})
    const pet = await db.pet.findFirst({
      where: { id: input.petKey, clienteId: user.cliente.id, ativo: true },
    })
    if (!pet)
      return NextResponse.json({ error: 'Pet não encontrado' }, { status: 404 })
    if ((input.gravataFoto||input.gravataNome) && !input.service.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('banho'))
      return NextResponse.json({ error: 'A gravata personalizada está disponível nos serviços de banho.' }, { status: 400 })
    const result=await db.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('matilha-agenda-reservas'))`
      const clienteId=user.cliente!.id
      const existente=await tx.bookingRequest.findUnique({where:{clienteId_petKey_desiredAt:{clienteId,petKey:pet.id,desiredAt:desired}},include:{pagamentoVenda:{select:{id:true,total:true,status:true,mercadoPagoStatus:true}}}})
      if(existente){
       if(existente.agendamentoId&&existente.status==='confirmado'&&existente.service===input.service)return {booking:existente,reused:true}
       return {error:'Já existe um registro para este pet neste horário. Consulte seus agendamentos ou escolha outra hora.',status:409}
      }
      if(desired<=new Date())return {error:'Este horário já passou. Escolha outro.',status:409}
      const reserva=await selecionarReservaAutomatica(tx,pet.raca,input.service,desired)
      if(!reserva)return {error:'O horário não está mais disponível. Atualize a agenda e escolha outro.',status:409}
      const {servico,profissionalId}=reserva
      const fim=new Date(desired.getTime()+servico.duracaoMinutos*60000)
      const conflitos=await tx.agendamento.findMany({where:{petId:pet.id,status:{in:['agendado','confirmado']},dataHora:{gte:new Date(desired.getTime()-1440*60000),lt:fim}},select:{dataHora:true,duracaoMinutos:true}})
      if(conflitos.some(a=>a.dataHora.getTime()+(a.duracaoMinutos??720)*60000>desired.getTime()))return {error:'Este pet já tem um atendimento que coincide com o horário escolhido.',status:409}
      const agendamento=await tx.agendamento.create({data:{clienteId,petId:pet.id,profissionalId,servico:servico.nome,categoria:inferirCategoriaAgenda(servico.nome),dataHora:desired,duracaoMinutos:servico.duracaoMinutos,status:'confirmado',observacoes:input.notes||null}})
      const booking=await tx.bookingRequest.create({data:{...input,clienteId,petName:pet.nome,desiredAt:desired,status:'confirmado',confirmedAt:desired,confirmationRef:agendamento.id,reply:'Agendamento confirmado automaticamente pelo portal.',agendamentoId:agendamento.id,pagamentoOnlineObrigatorio:true,gravataPrecoCentavos:input.gravataFoto||input.gravataNome?500:0,servicoPrecoCentavos:servico.precoCentavos},include:{pagamentoVenda:{select:{id:true,total:true,status:true,mercadoPagoStatus:true}}}})
      await tx.agendaEvento.create({data:{agendamentoId:agendamento.id,acao:'confirmado_automaticamente',autorId:user.id,detalhe:'Reserva pelo portal do cliente'}})
      return {booking,reused:false}
    },{isolationLevel:'Serializable'})
    if('error'in result)return NextResponse.json({error:result.error},{status:result.status})
    return NextResponse.json(result.booking,{status:result.reused?200:201})
  } catch (error) {
    if(['P2034','P2002'].includes((error as {code?:string})?.code||''))return NextResponse.json({error:'A agenda mudou durante a reserva. Atualize e tente novamente.'},{status:409})
    return experienceError(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req)
    const user = await getUsuarioLogado()
    if (!user?.cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const id = z
      .string()
      .min(1)
      .max(100)
      .parse(req.nextUrl.searchParams.get('id'))
    const result = await db.bookingRequest.updateMany({
      where: { id, clienteId: user.cliente.id, status: 'solicitado' },
      data: { status: 'cancelado' },
    })
    if (!result.count)
      return NextResponse.json(
        {
          error:
            'Solicitação não encontrada ou já respondida. Fale com a loja para alterar uma reserva confirmada.',
        },
        { status: 409 },
      )
    return NextResponse.json({ ok: true })
  } catch (error) {
    return experienceError(error)
  }
}
