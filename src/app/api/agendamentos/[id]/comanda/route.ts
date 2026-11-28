import {NextRequest,NextResponse} from 'next/server'
import {db} from '@/lib/db'
import {getUsuarioLogado} from '@/lib/auth-cookies'
import {assertSameOrigin} from '@/lib/auth-http'
import {requiresFichaAtendimento} from '@/lib/atendimento-flow'
import {catalogoPorRaca,slugServico} from '@/lib/catalogo-servicos-matilha'
import {z} from 'zod'

export const dynamic='force-dynamic'
type Params={params:Promise<{id:string}>}
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private,no-store'}})
const select={id:true,petId:true,servico:true,status:true,createdAt:true,valorServico:true} as const
export async function GET(_req:NextRequest,{params}:Params){
 const u=await getUsuarioLogado()
 if(u?.role!=='ADMIN')return json({error:'Acesso restrito à administração.'},403)
 const {id}=await params
 const a=await db.agendamento.findUnique({where:{id},select:{petId:true,status:true,servico:true,processo:{select}}})
 if(!a)return json({error:'Agendamento não encontrado.'},404)
 const candidatos=a.processo?[]:await db.processo.findMany({where:{petId:a.petId,agendamentoId:null,status:{in:['novo','em_andamento','aguardando_resposta']}},select,orderBy:{createdAt:'desc'},take:50})
 return json({processo:a.processo,candidatos,encerrado:['cancelado','concluido'].includes(a.status)})
}
export async function POST(req:NextRequest,{params}:Params){
 const u=await getUsuarioLogado()
 if(u?.role!=='ADMIN')return json({error:'Acesso restrito à administração.'},403)
 try{
  assertSameOrigin(req)
  const {id}=await params
  const input=z.object({processoId:z.string().min(1).max(100).optional()}).strict().parse(await req.json())
  const result=await db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'agenda-comanda:'+id}))`
   const a=await tx.agendamento.findUnique({where:{id},include:{processo:{select},pet:{select:{raca:true,clienteId:true}},profissional:{select:{nome:true}}}})
   if(!a)return {error:'Agendamento não encontrado.',status:404}
   if(a.processo)return {processo:a.processo}
   if(['cancelado','concluido'].includes(a.status))return {error:'Agendamento encerrado. Não crie novo atendimento.',status:409}
   if(a.pet.clienteId!==a.clienteId)return {error:'Pet não corresponde ao tutor.',status:409}
   if(input.processoId){
    const p=await tx.processo.findFirst({where:{id:input.processoId,petId:a.petId,agendamentoId:null,status:{in:['novo','em_andamento','aguardando_resposta']}},select})
    if(!p||slugServico(p.servico)!==slugServico(a.servico))return {error:'Selecione um atendimento ativo do mesmo pet e serviço.',status:409}
    return {processo:await tx.processo.update({where:{id:p.id},data:{agendamentoId:id},select})}
   }
   if(await tx.processo.count({where:{petId:a.petId,status:{in:['novo','em_andamento','aguardando_resposta']}}}))return {error:'Já existe atendimento ativo deste pet. Vincule o registro correto antes de criar outro.',status:409}
   const configs=await tx.servicoEsteticoConfig.findMany()
   const preco=catalogoPorRaca(configs,a.pet.raca).opcoes.find(s=>slugServico(s.nome)===slugServico(a.servico))
   if(!preco)return {error:'Confirme o preço do serviço para esta raça no cadastro antes de abrir a comanda.',status:409}
   const p=await tx.processo.create({data:{agendamentoId:id,petId:a.petId,servico:a.servico,valorServico:preco.precoCentavos/100,responsavel:a.profissional?.nome??null,requiresFicha:requiresFichaAtendimento(a.servico),status:'novo'},select})
   return {processo:p}
  },{isolationLevel:'Serializable'})
  return 'error'in result?json({error:result.error},result.status):json(result)
 }catch(e){if(e instanceof z.ZodError)return json({error:'Dados inválidos.'},400);return json({error:'Não foi possível abrir a comanda. Atualize e tente novamente.'},409)}
}
