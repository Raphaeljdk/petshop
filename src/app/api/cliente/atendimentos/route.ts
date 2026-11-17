import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'

export const dynamic='force-dynamic'
export async function GET(){
 const user=await getUsuarioLogado()
 if(user?.role!=='CLIENTE'||!user.clienteId)
  return NextResponse.json({error:'Tutor não autenticado.'},{status:401})
 const fichas=await db.atendimentoFicha.findMany({
  where:{clienteId:user.clienteId,checkinSubmittedAt:{not:null}},
  orderBy:{createdAt:'desc'},take:100,
  select:{
   id:true,petId:true,processoId:true,checkin:true,checkinStatus:true,
   checkinSubmittedAt:true,tutorAceiteAt:true,tutorAceiteNome:true,tutorAceiteVersao:true,
   checkout:true,checkoutFinalizadoAt:true,createdAt:true,
   processo:{select:{servico:true,createdAt:true,pet:{select:{id:true,nome:true,raca:true}}}},
  },
 })
 // Não expor rascunhos internos do check-out ao cliente.
 return NextResponse.json({fichas:fichas.map(f=>({...f,checkout:f.checkoutFinalizadoAt?f.checkout:null}))},{headers:{'Cache-Control':'private,no-store'}})
}
