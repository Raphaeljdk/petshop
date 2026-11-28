import {NextRequest,NextResponse} from 'next/server'
import {db} from '@/lib/db'
import {getUsuarioLogado} from '@/lib/auth-cookies'
import {assertSameOrigin} from '@/lib/auth-http'
import {listarServicosParaConfiguracao} from '@/lib/catalogo-servicos-matilha'
import {escalaSemanalSchema} from '@/lib/agenda-escala-semanal'
const select={diaSemana:true,inicio:true,fim:true,servicos:true,turnos:true} as const
export const dynamic='force-dynamic'
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private,no-store'}})
export async function GET(){
 const u=await getUsuarioLogado()
 if(u?.role!=='ADMIN')return json({error:'Acesso restrito.'},403)
 const [dias,configs,equipe]=await Promise.all([db.agendaEscalaSemanal.findMany({select,orderBy:{diaSemana:'asc'}}),db.servicoEsteticoConfig.findMany(),db.profissionalAgenda.findMany({where:{ativo:true},select:{id:true,nome:true,especialidades:true},orderBy:{nome:'asc'}})])
 return json({dias,servicos:listarServicosParaConfiguracao(configs).map(s=>({chave:s.chave,nome:s.nome})),equipe})
}
export async function PUT(req:NextRequest){
 const u=await getUsuarioLogado()
 if(u?.role!=='ADMIN')return json({error:'Acesso restrito.'},403)
 try{
  assertSameOrigin(req)
  const parsed=escalaSemanalSchema.safeParse(await req.json())
  if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'Escala inválida.'},400)
  const dias=parsed.data
  if(dias.some(d=>!d.turnos.length||!d.servicos.length))return json({error:'Cada dia aberto precisa de pelo menos um funcionário com turno e um serviço habilitado. Desmarque dias fechados.'},400)
  const [configs,equipe]=await Promise.all([db.servicoEsteticoConfig.findMany(),db.profissionalAgenda.findMany({where:{ativo:true},select:{id:true}})])
  const ids=new Set(equipe.map(p=>p.id)),chaves=new Set(listarServicosParaConfiguracao(configs).map(s=>s.chave))
  if(dias.some(d=>d.turnos.some(t=>!ids.has(t.profissionalId))||d.servicos.some(s=>!chaves.has(s.chave)||s.profissionais.some(id=>!ids.has(id)))))return json({error:'Selecione serviços cadastrados e profissionais ativos.'},409)
  await db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('agenda-escala-semanal'))`
   await tx.agendaEscalaSemanal.deleteMany({where:{diaSemana:{notIn:dias.map(d=>d.diaSemana)}}})
   for(const d of dias)await tx.agendaEscalaSemanal.upsert({where:{diaSemana:d.diaSemana},create:{...d,atualizadoPorId:u.id},update:{...d,atualizadoPorId:u.id}})
  },{isolationLevel:'Serializable'})
  return json({ok:true})
 }catch{return json({error:'Não foi possível salvar. Atualize e tente novamente.'},409)}
}
