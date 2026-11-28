import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { diaAgendaSchema } from '@/lib/agenda-servicos-dia'
import { consultarHorariosPublicos } from '@/lib/catalogo-agenda-publica'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
 const headers={'Cache-Control':'private, no-store'}
 const petKey=req.nextUrl.searchParams.get('petKey')
 const dia=diaAgendaSchema.safeParse(req.nextUrl.searchParams.get('dia'))
 const chave=req.nextUrl.searchParams.get('servico')
 if(!petKey||petKey.length>100||!dia.success||!chave||chave.length>100)return NextResponse.json({error:'Selecione o pet, o serviço e uma data válida.'},{status:400,headers})
 try{
  const user=await getUsuarioLogado()
  if(!user?.cliente)return NextResponse.json({error:'Não autenticado.'},{status:401,headers})
  const pet=await db.pet.findFirst({where:{id:petKey,clienteId:user.cliente.id,ativo:true},select:{raca:true}})
  if(!pet)return NextResponse.json({error:'Pet não encontrado.'},{status:404,headers})
  return NextResponse.json(await consultarHorariosPublicos(pet.raca,dia.data,chave),{headers})
 }catch{ return NextResponse.json({error:'Não foi possível consultar os horários.'},{status:500,headers}) }
}
