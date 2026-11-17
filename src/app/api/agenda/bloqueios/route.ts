import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'

export const dynamic='force-dynamic'
const schema=z.object({
  profissionalId:z.string().min(1),
  tipo:z.enum(['almoco','taxdog','outro']),
  inicio:z.string().datetime({offset:true}),
  fim:z.string().datetime({offset:true}),
  observacoes:z.string().trim().max(250).optional(),
}).strict()

async function admin() {
  const user=await getUsuarioLogado()
  return user?.role==='ADMIN'?user:null
}
export async function GET(req: NextRequest) {
  if (!await admin()) return NextResponse.json({error:'Acesso negado.'},{status:403})
  const de=req.nextUrl.searchParams.get('inicio')
  const ate=req.nextUrl.searchParams.get('fim')
  const where=de&&ate&&Number.isFinite(Date.parse(de))&&Number.isFinite(Date.parse(ate))?
    {inicio:{lt:new Date(ate)},fim:{gt:new Date(de)}}:{}
  const items=await db.agendaBloqueio.findMany({
    where,orderBy:{inicio:'asc'},take:300,
    include:{profissional:{select:{nome:true}}},
  })
  return NextResponse.json({items},{headers:{'Cache-Control':'private, no-store'}})
}
export async function POST(req:NextRequest) {
  const user=await admin()
  if(!user)return NextResponse.json({error:'Acesso negado.'},{status:403})
  try{
    assertSameOrigin(req)
    const data=schema.parse(await req.json())
    const inicio=new Date(data.inicio),fim=new Date(data.fim)
    if(fim<=inicio || fim.getTime()-inicio.getTime()>24*3600_000 ||
       inicio.getTime()<Date.now()-60_000 || inicio.getTime()>Date.now()+365*86400_000)
      return NextResponse.json({error:'Informe intervalo futuro de até 24 horas.'},{status:400})
    const result=await db.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'profissional-agenda:' + data.profissionalId}))`
      const profissional=await tx.profissionalAgenda.findFirst({where:{id:data.profissionalId,ativo:true},select:{id:true}})
      if(!profissional)return {error:'Profissional não encontrado ou inativo.'}
      const exists=await tx.agendaBloqueio.findFirst({where:{
        profissionalId:data.profissionalId,inicio:{lt:fim},fim:{gt:inicio}},select:{id:true}})
      if(exists)return {error:'Já existe bloqueio sobreposto nesse período.'}
      // Não ocultar uma reserva existente debaixo de um novo bloqueio.
      const clash=await tx.agendamento.findFirst({
        where:{profissionalId:data.profissionalId,status:{in:['agendado','confirmado']},
          dataHora:{gte:new Date(inicio.getTime()-60*60_000),lt:fim}},
        select:{id:true},
      })
      if(clash)return {error:'Há agendamento existente nesse horário. Remarque-o antes de bloquear.'}
      const item=await tx.agendaBloqueio.create({data:{
        profissionalId:data.profissionalId,inicio,fim,tipo:data.tipo,
        observacoes:data.observacoes||null,criadoPorId:user.id,
      }})
      return {item}
    })
    if('error' in result)return NextResponse.json({error:result.error},{status:409})
    return NextResponse.json(result.item,{status:201})
  }catch(e){
    if(e instanceof z.ZodError)return NextResponse.json({error:e.issues[0]?.message||'Dados inválidos.'},{status:400})
    console.error('[agenda/bloqueios]',e)
    return NextResponse.json({error:'Não foi possível bloquear o horário.'},{status:500})
  }
}
export async function DELETE(req:NextRequest) {
  if(!await admin())return NextResponse.json({error:'Acesso negado.'},{status:403})
  try{
    assertSameOrigin(req)
    const id=z.string().min(1).max(100).parse(req.nextUrl.searchParams.get('id'))
    const removed=await db.agendaBloqueio.deleteMany({where:{id}})
    return NextResponse.json({success:removed.count>0})
  }catch(e){return NextResponse.json({error:'Não foi possível liberar o horário.'},{status:400})}
}
