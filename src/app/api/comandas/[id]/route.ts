import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { experienceBody, experienceError } from '@/lib/customer-experience'
import { consultarCatalogoPublico } from '@/lib/catalogo-agenda-publica'

export const dynamic = 'force-dynamic'
type Route = { params: Promise<{id:string}> }
const json = (data:unknown,status=200) => NextResponse.json(data,{status,headers:{'Cache-Control':'private,no-store'}})
const actions = z.discriminatedUnion('action',[
 z.object({action:z.literal('solicitar'),chave:z.string().min(2).max(100),motivo:z.string().trim().max(300).optional()}).strict(),
 z.object({action:z.literal('responder'),extraId:z.string().min(1).max(100),aceitar:z.boolean()}).strict(),
 z.object({action:z.literal('confirmar-equipe'),extraId:z.string().min(1).max(100),aceitar:z.boolean()}).strict(),
 z.object({action:z.literal('realizar'),extraId:z.string().min(1).max(100)}).strict(),
 z.object({action:z.literal('cobrar'),extraId:z.string().min(1).max(100)}).strict(),
])
async function contexto(id:string) {
 const user=await getUsuarioLogado()
 const staff=!!user&&['ADMIN','KANBAN'].includes(user.role)
 if(!user||(!staff&&(user.role!=='CLIENTE'||!user.clienteId)))return null
 const processo=await db.processo.findFirst({where:{id,...(!staff?{pet:{clienteId:user.clienteId!}}:{})},
  select:{id:true,servico:true,status:true,valorServico:true,pet:{select:{nome:true,raca:true,clienteId:true}},
   ficha:{select:{checkinStatus:true,checkoutFinalizadoAt:true}}}})
 return processo?{user,staff,processo}:null
}
function aberto(p:{status:string;ficha:{checkinStatus:string;checkoutFinalizadoAt:Date|null}|null}){
 return ['em_andamento','aguardando_resposta'].includes(p.status)&&!p.ficha?.checkoutFinalizadoAt&&(!p.ficha||p.ficha.checkinStatus==='aceito')
}
export async function GET(_req:NextRequest,{params}:Route) {
 try {
  const {id}=await params;const ctx=await contexto(id)
  if(!ctx)return json({error:'Comanda não encontrada.'},404)
  const [extras,vendas,catalogo]=await Promise.all([
   db.comandaServicoExtra.findMany({where:{processoId:id},include:{venda:{select:{id:true,total:true,status:true,mercadoPagoStatus:true}}},orderBy:{createdAt:'asc'}}),
   db.venda.findMany({where:{comandaProcessoId:id,comandaExtra:null},select:{id:true,total:true,status:true,mercadoPagoStatus:true,statusEntrega:true,itens:{select:{quantidade:true,precoUnit:true,produto:{select:{nome:true}}}}},orderBy:{createdAt:'asc'}}),
   aberto(ctx.processo)?consultarCatalogoPublico(ctx.processo.pet.raca,new Date()):Promise.resolve({servicos:[]}),
  ])
  return json({processo:{id,servico:ctx.processo.servico,status:ctx.processo.status,valorServico:ctx.processo.valorServico,petNome:ctx.processo.pet.nome},aberto:aberto(ctx.processo),extras,vendas,servicos:catalogo.servicos})
 }catch(e){return experienceError(e)}
}
export async function POST(req:NextRequest,{params}:Route) {
 try{
  const {id}=await params;const ctx=await contexto(id)
  if(!ctx)return json({error:'Comanda não encontrada.'},404)
  const input=actions.parse(await experienceBody(req))
  if(input.action==='cobrar'&&ctx.staff)return json({error:'O tutor deve iniciar o pagamento no portal.'},403)
  if(input.action!=='cobrar'&&!aberto(ctx.processo))return json({error:'Atendimento não está aberto para adicionais.'},409)
  const cotacao=input.action==='solicitar'?(await consultarCatalogoPublico(ctx.processo.pet.raca,new Date())).servicos.find(s=>s.chave===input.chave):null
  if(input.action==='solicitar'&&!cotacao)return json({error:'Serviço não disponível neste momento para a raça.'},409)
  const result=await db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'comanda:'+id}))`
   const p=await tx.processo.findUnique({where:{id},select:{status:true,pet:{select:{clienteId:true,nome:true}},ficha:{select:{checkinStatus:true,checkoutFinalizadoAt:true}}}})
   if(!p||(!ctx.staff&&p.pet.clienteId!==ctx.user.clienteId))return {error:'Comanda não encontrada.',status:404}
   if(input.action!=='cobrar'&&!aberto(p))return {error:'Atendimento encerrado.',status:409}
   if(input.action==='solicitar'&&cotacao){
    const duplicado=await tx.comandaServicoExtra.findFirst({where:{processoId:id,chaveServico:cotacao.chave,status:{notIn:['recusado','cancelado','realizado']}}})
    if(duplicado)return {error:'Já existe uma solicitação deste serviço.',status:409}
    const extra=await tx.comandaServicoExtra.create({data:{processoId:id,chaveServico:cotacao.chave,nome:cotacao.nome,precoCentavos:cotacao.precoCentavos,duracaoMinutos:cotacao.duracaoMinutos,motivo:input.motivo||null,origem:ctx.staff?'equipe':'tutor',status:ctx.staff?'aguardando_tutor':'aguardando_equipe',solicitadoPorId:ctx.user.id,...(ctx.staff?{equipePorId:ctx.user.id,equipeEm:new Date()}:{aceitoPorId:ctx.user.id,respondidoEm:new Date()})}})
    if(ctx.staff){
     const mensagem='A equipe recomenda '+extra.nome+' para '+p.pet.nome+'. Valor: R$ '+(extra.precoCentavos/100).toFixed(2).replace('.',',')+'. Acesse Agendamentos e responda na comanda.'
     await tx.portalMessageDelivery.create({data:{uniqueKey:'comanda:'+extra.id+':app',clienteId:p.pet.clienteId,channel:'app',kind:'autorizacao_servico',text:mensagem,status:'enviado',sentAt:new Date()}})
     const prefs=await tx.portalClientPreferences.findUnique({where:{clienteId:p.pet.clienteId}})
     if(prefs?.remindersEmail)await tx.portalMessageDelivery.create({data:{uniqueKey:'comanda:'+extra.id+':email',clienteId:p.pet.clienteId,channel:'email',kind:'autorizacao_servico',text:mensagem}})
    }
    return {extra}
   }
   if(input.action==='solicitar')return {error:'Serviço indisponível.',status:409}
   const extra=await tx.comandaServicoExtra.findFirst({where:{id:input.extraId,processoId:id},include:{venda:true}})
   if(!extra)return {error:'Adicional não encontrado.',status:404}
   if(input.action==='responder'){
    if(ctx.staff||extra.status!=='aguardando_tutor')return {error:'Apenas o tutor pode responder uma autorização pendente.',status:403}
    return {extra:await tx.comandaServicoExtra.update({where:{id:extra.id},data:{status:input.aceitar?'autorizado':'recusado',aceitoPorId:ctx.user.id,respondidoEm:new Date()}})}
   }
   if(input.action==='confirmar-equipe'){
    if(!ctx.staff||extra.status!=='aguardando_equipe')return {error:'Ação não permitida.',status:403}
    return {extra:await tx.comandaServicoExtra.update({where:{id:extra.id},data:{status:input.aceitar?'autorizado':'recusado',equipePorId:ctx.user.id,equipeEm:new Date()}})}
   }
   if(input.action==='realizar'){
    if(!ctx.staff||extra.status!=='autorizado'||!extra.aceitoPorId||!extra.equipePorId)return {error:'Serviço sem aceite do tutor e confirmação da equipe.',status:409}
    return {extra:await tx.comandaServicoExtra.update({where:{id:extra.id},data:{status:'realizado',realizadoEm:new Date()}})}
   }
   if(!['autorizado','realizado'].includes(extra.status)||!extra.aceitoPorId||!extra.equipePorId||extra.precoCentavos<=0)return {error:'Adicional ainda não autorizado para cobrança.',status:409}
   if(extra.venda&&extra.venda.status!=='cancelada')return {venda:{id:extra.venda.id,total:extra.venda.total,status:extra.venda.status}}
   if(extra.venda)return {error:'Cobrança cancelada. A equipe deve conciliar antes de gerar outra.',status:409}
   const venda=await tx.venda.create({data:{clienteId:p.pet.clienteId,comandaProcessoId:id,canal:'site',status:'pendente',total:extra.precoCentavos/100,subtotalProdutos:0,observacoes:'Serviço adicional (NFS-e separada): '+extra.nome,tipoEntrega:'retirada',valorFrete:0},select:{id:true,total:true,status:true}})
   await tx.comandaServicoExtra.update({where:{id:extra.id},data:{vendaId:venda.id}})
   return {venda}
  },{isolationLevel:'Serializable'})
  if('error'in result)return json({error:result.error},result.status)
  return json(result)
 }catch(e){return experienceError(e)}
}
