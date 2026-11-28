import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'

export const dynamic = 'force-dynamic'
export async function GET() {
  const u = await getUsuarioLogado()
  if (u?.role !== 'CLIENTE' || !u.clienteId) return NextResponse.json({error:'Acesso negado.'},{status:403})
  const items = await db.processo.findMany({
    where: { pet: { clienteId: u.clienteId }, OR: [
      {status:{in:['em_andamento','aguardando_resposta']}},
      {status:'novo',comandaExtras:{some:{status:{in:['aguardando_tutor','aguardando_equipe','autorizado']}}}},
      {status:'finalizado',OR:[{comandaVendas:{some:{status:'pendente'}}},{comandaExtras:{some:{status:{in:['autorizado','realizado']},venda:null,precoCentavos:{gt:0}}}}]},
    ] },
    select: { id:true,servico:true,status:true,valorServico:true,pet:{select:{nome:true}} },
    orderBy:{createdAt:'desc'},take:30,
  })
  return NextResponse.json({items},{headers:{'Cache-Control':'private,no-store'}})
}
