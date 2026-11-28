import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { experienceBody, experienceError } from '@/lib/customer-experience'
import { slugServico,catalogoPorRaca } from '@/lib/catalogo-servicos-matilha'

import { adicionalLiberado, adicionalFinanceiramentePendente, pagamentoRealAprovado, adicionalPago, pendenciasFechamento,podeRegistrarPOS } from '@/lib/comanda-pagamento-policy'
import { assertSameOrigin } from '@/lib/auth-http'

export const dynamic = 'force-dynamic'
type Route = { params: Promise<{id:string}> }
const json = (data:unknown,status=200) => NextResponse.json(data,{status,headers:{'Cache-Control':'private,no-store'}})
const vendaSelect={id:true,total:true,status:true,posPagamentoId:true,posPagoCentavos:true,pagamentoOnlineIniciadoEm:true,creditoPresenteCentavos:true,mercadoPagoStatus:true,mercadoPagoId:true,mercadoPagoPaymentUrl:true} as const
const grupoSelect={...vendaSelect,comandaExtrasGrupo:{select:{precoCentavos:true}}} as const
const actions = z.discriminatedUnion('action',[
 z.object({action:z.literal('registrar-pos'),vendaIds:z.array(z.string().min(1).max(100)).min(1).max(100).refine(a=>new Set(a).size===a.length),adquirente:z.string().optional(),terminal:z.string().optional(),referencia:z.string().trim().min(3).max(100),metodo:z.enum(['credito','debito','pix_pos']),totalCentavos:z.number().int().positive().max(100000000),confirmado:z.literal(true)}).strict(),
 z.object({action:z.literal('pagar-grupo'),extraIds:z.array(z.string().min(1).max(100)).min(2).max(30).refine(a=>new Set(a).size===a.length)}).strict(),
 z.object({action:z.literal('fechar-financeiro')}).strict(),
 z.object({action:z.literal('cobrar-principal'),confirmarSemPagamentoAnterior:z.literal(true)}).strict(),
 z.object({action:z.literal('solicitar'),chave:z.string().min(2).max(100),motivo:z.string().trim().max(300).optional()}).strict(),
 z.object({action:z.literal('responder'),extraId:z.string().min(1).max(100),aceitar:z.boolean()}).strict(),
 z.object({action:z.literal('confirmar-equipe'),extraId:z.string().min(1).max(100),aceitar:z.boolean()}).strict(),
 z.object({action:z.literal('realizar'),extraId:z.string().min(1).max(100)}).strict(),
 z.object({action:z.literal('cobrar'),extraId:z.string().min(1).max(100)}).strict(),
 z.object({action:z.literal('vincular-agendamento'),bookingId:z.string().min(1).max(100)}).strict(),
])
async function contexto(id:string) {
 const user=await getUsuarioLogado()
 const staff=!!user&&['ADMIN','KANBAN'].includes(user.role)
 if(!user||(!staff&&(user.role!=='CLIENTE'||!user.clienteId)))return null
 const processo=await db.processo.findFirst({where:{id,...(!staff?{pet:{clienteId:user.clienteId!}}:{})},
  select:{id:true,petId:true,comandaFechadaEm:true,comandaPrincipalVendaId:true,bookingRequestId:true,servico:true,status:true,valorServico:true,pet:{select:{nome:true,raca:true,clienteId:true}},
   ficha:{select:{checkinStatus:true,checkoutFinalizadoAt:true}}}})
 return processo?{user,staff,processo}:null
}
function permiteSolicitar(p:{comandaFechadaEm?:Date|null;status:string;ficha:{checkinStatus:string;checkoutFinalizadoAt:Date|null}|null}){
 return !p.comandaFechadaEm&&!p.ficha?.checkoutFinalizadoAt && (['em_andamento','aguardando_resposta'].includes(p.status) || (p.status==='novo' && !!p.ficha && p.ficha.checkinStatus!=='recusado'))
}
function aberto(p:{comandaFechadaEm?:Date|null;status:string;ficha:{checkinStatus:string;checkoutFinalizadoAt:Date|null}|null}){
 return !p.comandaFechadaEm&&['em_andamento','aguardando_resposta'].includes(p.status)&&!p.ficha?.checkoutFinalizadoAt&&(!p.ficha||p.ficha.checkinStatus==='aceito')
}
export async function GET(_req:NextRequest,{params}:Route) {
 try {
  const {id}=await params;const ctx=await contexto(id)
  if(!ctx)return json({error:'Comanda não encontrada.'},404)
  const [extras,vendas,catalogo,solicitacoes,principal,avulsa]=await Promise.all([
   db.comandaServicoExtra.findMany({where:{processoId:id},include:{venda:{select:vendaSelect},grupoVenda:{select:grupoSelect}},orderBy:{createdAt:'asc'}}),
   db.venda.findMany({where:{comandaProcessoId:id,comandaExtra:null,comandaExtrasGrupo:{none:{}},comandaPrincipal:null,bookingPagamento:null},select:{...vendaSelect,statusEntrega:true,itens:{select:{quantidade:true,precoUnit:true,produto:{select:{nome:true}}}}},orderBy:{createdAt:'asc'}}),
   permiteSolicitar(ctx.processo)?db.servicoEsteticoConfig.findMany().then(configs=>catalogoPorRaca(configs,ctx.processo.pet.raca)):Promise.resolve({opcoes:[],pendentes:[]}),
   ctx.staff&&!ctx.processo.bookingRequestId&&permiteSolicitar(ctx.processo)?db.bookingRequest.findMany({where:{clienteId:ctx.processo.pet.clienteId,petKey:ctx.processo.petId,status:'confirmado',processo:null},select:{id:true,service:true,confirmedAt:true,gravataPrecoCentavos:true,gravataFoto:true,gravataIdeia:true,pagamentoVenda:{select:{status:true,mercadoPagoStatus:true}}},orderBy:{confirmedAt:'desc'},take:20}):Promise.resolve([]),
   ctx.processo.bookingRequestId?db.bookingRequest.findUnique({where:{id:ctx.processo.bookingRequestId},select:{servicoPrecoCentavos:true,gravataPrecoCentavos:true,gravataNome:true,gravataFoto:true,gravataIdeia:true,pagamentoVenda:{select:vendaSelect}}}):Promise.resolve(null),
   ctx.processo.comandaPrincipalVendaId?db.venda.findUnique({where:{id:ctx.processo.comandaPrincipalVendaId},select:vendaSelect}):Promise.resolve(null),
  ])
  const principalVenda=principal?.pagamentoVenda??avulsa
  const principalCentavos=principal?.servicoPrecoCentavos!=null?principal.servicoPrecoCentavos+principal.gravataPrecoCentavos:Math.round(ctx.processo.valorServico*100)
  const principalPago=principalCentavos===0||pagamentoRealAprovado(principalVenda,principalCentavos)
  const pendencias=pendenciasFechamento({principalPago,checkoutConcluido:ctx.processo.status==='finalizado'||!!ctx.processo.ficha?.checkoutFinalizadoAt,extras,produtos:vendas})
  const publicSale=(v:typeof principalVenda)=>v?{id:v.id,total:v.total,status:v.status,mercadoPagoStatus:v.mercadoPagoStatus,mercadoPagoPaymentUrl:v.mercadoPagoPaymentUrl,posPago:!!v.posPagamentoId,posElegivel:podeRegistrarPOS(v)}:null
  return json({gravata:principal?.gravataPrecoCentavos?{nome:principal.gravataNome,foto:principal.gravataFoto,ideia:principal.gravataIdeia,pago:principalPago,precoCentavos:principal.gravataPrecoCentavos}:null,fechadaEm:ctx.processo.comandaFechadaEm,pendencias,principalVenda:publicSale(principalVenda),processo:{id,servico:ctx.processo.servico,status:ctx.processo.status,valorServico:ctx.processo.valorServico,petNome:ctx.processo.pet.nome},principalPago,aberto:aberto(ctx.processo),permiteSolicitar:permiteSolicitar(ctx.processo),extras:extras.map(({grupoVenda,venda,...x})=>({...x,venda:publicSale(grupoVenda??venda),liberado:adicionalLiberado({...x,grupoVenda,venda}),pago:adicionalPago({...x,grupoVenda,venda}),pendenteFinanceiro:adicionalFinanceiramentePendente({...x,grupoVenda,venda})})),vendas:vendas.map(v=>({...v,posPago:!!v.posPagamentoId,posElegivel:podeRegistrarPOS(v)})),servicos:catalogo.opcoes,servicosPendentes:catalogo.pendentes,solicitacoes,bookingRequestId:ctx.processo.bookingRequestId})
 }catch(e){return experienceError(e)}
}
export async function POST(req:NextRequest,{params}:Route) {
 try{
  const {id}=await params;const ctx=await contexto(id)
  if(!ctx)return json({error:'Comanda não encontrada.'},404)
  assertSameOrigin(req)
  const input=actions.parse(await experienceBody(req))
  if(input.action==='cobrar'&&ctx.staff)return json({error:'O tutor deve iniciar o pagamento no portal.'},403)
  const duranteAnamnese=['solicitar','responder','confirmar-equipe','vincular-agendamento'].includes(input.action)
  const financeiro=['cobrar','pagar-grupo','fechar-financeiro','cobrar-principal','registrar-pos'].includes(input.action)
  if(!financeiro&&!(duranteAnamnese?permiteSolicitar(ctx.processo):aberto(ctx.processo)))return json({error:'Atendimento não está aberto para adicionais.'},409)
  const cotacao=input.action==='solicitar'?catalogoPorRaca(await db.servicoEsteticoConfig.findMany(),ctx.processo.pet.raca).opcoes.find(s=>s.chave===input.chave):null
  if(input.action==='solicitar'&&!cotacao)return json({error:'Serviço não disponível neste momento para a raça.'},409)
  const result=await db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'comanda:'+id}))`
   const p=await tx.processo.findUnique({where:{id},select:{status:true,servico:true,petId:true,valorServico:true,comandaFechadaEm:true,comandaPrincipalVendaId:true,comandaPrincipalVenda:{select:vendaSelect},bookingRequest:{include:{pagamentoVenda:true}},bookingRequestId:true,pet:{select:{clienteId:true,nome:true}},ficha:{select:{checkinStatus:true,checkoutFinalizadoAt:true}}}})
   if(!p||(!ctx.staff&&p.pet.clienteId!==ctx.user.clienteId))return {error:'Comanda não encontrada.',status:404}
   if(!financeiro&&!(duranteAnamnese?permiteSolicitar(p):aberto(p)))return {error:'Atendimento encerrado.',status:409}
   if(p.comandaFechadaEm||p.status==='cancelado')return {error:'Comanda financeiramente encerrada.',status:409}
   if(input.action==='registrar-pos'){
    if(ctx.user.role!=='ADMIN')return {error:'Somente administradores podem conciliar comprovantes POS.',status:403}
    const ids=[...input.vendaIds].sort()
    for(const vendaId of ids)await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'sale:'+vendaId}))`
    const vendas=await tx.venda.findMany({where:{id:{in:ids},clienteId:p.pet.clienteId,OR:[{comandaProcessoId:id},...(p.bookingRequest?.pagamentoVendaId?[{id:p.bookingRequest.pagamentoVendaId}]:[])]},select:vendaSelect})
    if(vendas.length!==ids.length||vendas.some(v=>!podeRegistrarPOS(v)))return {error:'Há uma cobrança já paga, cancelada ou iniciada online. Concilie antes de receber na maquininha.',status:409}
    const total=vendas.reduce((n,v)=>n+Math.round(v.total*100),0)
    if(total!==input.totalCentavos)return {error:'O valor do comprovante precisa corresponder ao saldo selecionado.',status:409}
    const adquirente='MERCADO PAGO',terminal='POINT',referencia=input.referencia.toUpperCase()
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'pos:mercado-pago:'+referencia}))`
    if(await tx.comandaPagamentoPOS.findFirst({where:{referencia:{equals:referencia,mode:'insensitive'},OR:[{adquirente:{equals:'MERCADO PAGO',mode:'insensitive'}},{adquirente:{equals:'MERCADOPAGO',mode:'insensitive'}},{adquirente:{equals:'MP',mode:'insensitive'}}]}}))return {error:'Este comprovante POS já foi registrado.',status:409}
    const recibo=await tx.comandaPagamentoPOS.create({data:{processoId:id,registradoPorId:ctx.user.id,adquirente,terminal,referencia,metodo:input.metodo,totalCentavos:total}})
    for(const v of vendas){
     const alterada=await tx.venda.updateMany({where:{id:v.id,status:'pendente',posPagamentoId:null,mercadoPagoId:null,mercadoPagoStatus:null,pagamentoOnlineIniciadoEm:null},data:{status:'concluida',posPagamentoId:recibo.id,posPagoCentavos:Math.round(v.total*100),comandaProcessoId:id}})
     if(alterada.count!==1)throw Error('Cobrança alterada durante a conciliação POS.')
    }
    const extras=await tx.comandaServicoExtra.findMany({where:{processoId:id},include:{venda:true,grupoVenda:{select:grupoSelect}}})
    const produtos=await tx.venda.findMany({where:{comandaProcessoId:id,comandaExtra:null,comandaExtrasGrupo:{none:{}},comandaPrincipal:null,bookingPagamento:null},select:vendaSelect})
    const b=p.bookingRequest
    const principalId=b?.pagamentoVendaId??p.comandaPrincipalVendaId
    const principal=principalId?await tx.venda.findUnique({where:{id:principalId},select:vendaSelect}):null
    const valor=b?.servicoPrecoCentavos!=null?b.servicoPrecoCentavos+b.gravataPrecoCentavos:Math.round(p.valorServico*100)
    const pendencias=pendenciasFechamento({principalPago:valor===0||pagamentoRealAprovado(principal,valor),checkoutConcluido:p.status==='finalizado'||!!p.ficha?.checkoutFinalizadoAt,extras,produtos})
    if(!pendencias.length)await tx.processo.update({where:{id},data:{comandaFechadaEm:new Date(),comandaFechadaPorId:ctx.user.id}})
    return {ok:true,encerrada:!pendencias.length,pendencias}
   }
   if(input.action==='fechar-financeiro'){
    if(!ctx.staff)return {error:'Acesso restrito à equipe.',status:403}
    const extras=await tx.comandaServicoExtra.findMany({where:{processoId:id},include:{venda:true,grupoVenda:{select:grupoSelect}}})
    const produtos=await tx.venda.findMany({where:{comandaProcessoId:id,comandaExtra:null,comandaExtrasGrupo:{none:{}},comandaPrincipal:null,bookingPagamento:null},select:vendaSelect})
    const b=p.bookingRequest
    const valor=b?.servicoPrecoCentavos!=null?b.servicoPrecoCentavos+b.gravataPrecoCentavos:Math.round(p.valorServico*100)
    const pendencias=pendenciasFechamento({principalPago:valor===0||pagamentoRealAprovado(b?.pagamentoVenda??p.comandaPrincipalVenda,valor),checkoutConcluido:p.status==='finalizado'||!!p.ficha?.checkoutFinalizadoAt,extras,produtos})
    if(pendencias.length)return {error:pendencias.join(' '),status:409}
    await tx.processo.update({where:{id},data:{comandaFechadaEm:new Date(),comandaFechadaPorId:ctx.user.id}})
    return {ok:true}
   }
   if(input.action==='cobrar-principal'){
    if(!ctx.staff||p.status==='cancelado')return {error:'Apenas a equipe pode cobrar uma comanda válida.',status:409}
    if(p.bookingRequest){
     const b=p.bookingRequest
     if(b.status!=='confirmado')return {error:'Agendamento não confirmado.',status:409}
     if(b.pagamentoVenda){
      if(b.pagamentoVenda.status==='cancelada')return {error:'Cobrança cancelada. Concilie antes de emitir outra.',status:409}
      if(b.pagamentoVenda.comandaProcessoId&&b.pagamentoVenda.comandaProcessoId!==id)return {error:'Pagamento vinculado a outro atendimento.',status:409}
      const venda=await tx.venda.update({where:{id:b.pagamentoVenda.id},data:{comandaProcessoId:id},select:vendaSelect})
      return {venda}
     }
     const centavos=b.servicoPrecoCentavos==null?Math.round(p.valorServico*100):b.servicoPrecoCentavos
     if(!Number.isSafeInteger(centavos)||centavos<=0)return {error:'Preço principal inválido.',status:409}
     const venda=await tx.venda.create({data:{clienteId:p.pet.clienteId,comandaProcessoId:id,canal:'site',status:'pendente',total:(centavos+b.gravataPrecoCentavos)/100,subtotalProdutos:0,observacoes:'Agendamento e personalização, quando incluída (NFS-e separada)',tipoEntrega:'retirada',valorFrete:0},select:vendaSelect})
     await tx.bookingRequest.update({where:{id:b.id},data:{pagamentoVendaId:venda.id,servicoPrecoCentavos:centavos,pagamentoOnlineObrigatorio:true}})
     return {venda}
    }
    if(p.comandaPrincipalVenda)return {venda:p.comandaPrincipalVenda}
    const reservas=await tx.bookingRequest.findMany({where:{clienteId:p.pet.clienteId,petKey:p.petId,status:'confirmado',processo:null,pagamentoVendaId:{not:null}},select:{service:true}})
    if(reservas.some(b=>slugServico(b.service)===slugServico(p.servico)))return {error:'Existe agendamento com cobrança registrada. Vincule e concilie antes de gerar outra.',status:409}
    if(!Number.isSafeInteger(Math.round(p.valorServico*100))||p.valorServico<=0)return {error:'Valor principal inválido.',status:409}
    const venda=await tx.venda.create({data:{clienteId:p.pet.clienteId,comandaProcessoId:id,canal:'site',status:'pendente',total:p.valorServico,subtotalProdutos:0,observacoes:'Serviço principal da comanda (NFS-e separada)',tipoEntrega:'retirada',valorFrete:0},select:vendaSelect})
    await tx.processo.update({where:{id},data:{comandaPrincipalVendaId:venda.id}})
    return {venda}
   }
   if(input.action==='pagar-grupo'){
    if(ctx.staff||p.status==='cancelado')return {error:'Somente o tutor pode autorizar e pagar adicionais.',status:403}
    const extras=await tx.comandaServicoExtra.findMany({where:{processoId:id,id:{in:input.extraIds}},include:{venda:true,grupoVenda:true}})
    if(extras.length!==input.extraIds.length)return {error:'Adicionais inválidos.',status:409}
    const grupo=extras[0]?.grupoVenda
    if(grupo&&extras.every(x=>x.grupoVendaId===grupo.id)&&await tx.comandaServicoExtra.count({where:{grupoVendaId:grupo.id}})===extras.length)return {venda:{id:grupo.id,total:grupo.total,status:grupo.status}}
    if(extras.some(x=>x.vendaId||x.grupoVendaId||x.precoCentavos<=0||!x.equipePorId||!['aguardando_tutor','autorizado'].includes(x.status)||(x.status==='autorizado'&&!x.aceitoPorId)))return {error:'Selecione somente adicionais disponíveis, sem cobrança já criada.',status:409}
    if(extras.some(x=>x.status==='aguardando_tutor')&&!permiteSolicitar(p))return {error:'Atendimento encerrado para novas autorizações.',status:409}
    const total=extras.reduce((a,x)=>a+x.precoCentavos,0)
    const venda=await tx.venda.create({data:{clienteId:p.pet.clienteId,comandaProcessoId:id,canal:'site',status:'pendente',total:total/100,subtotalProdutos:0,observacoes:'Serviços adicionais agrupados (NFS-e separada)',tipoEntrega:'retirada',valorFrete:0},select:{id:true,total:true,status:true}})
    for(const x of extras)await tx.comandaServicoExtra.update({where:{id:x.id},data:{grupoVendaId:venda.id,...(x.status==='aguardando_tutor'?{status:'autorizado',aceitoPorId:ctx.user.id,respondidoEm:new Date()}:{})}})
    return {venda}
   }
   if(input.action==='vincular-agendamento'){
    if(!ctx.staff||p.bookingRequestId||p.comandaPrincipalVendaId)return {error:'Apenas a equipe pode vincular um agendamento ainda não utilizado.',status:409}
    const booking=await tx.bookingRequest.findFirst({where:{id:input.bookingId,clienteId:p.pet.clienteId,petKey:p.petId,status:'confirmado',processo:null},include:{cliente:{select:{user:{select:{id:true}}}},pagamentoVenda:true}})
    if(!booking||slugServico(booking.service)!==slugServico(p.servico))return {error:'Selecione um agendamento confirmado do mesmo pet e serviço.',status:409}
    if((booking.pagamentoOnlineObrigatorio||(booking.gravataFoto&&booking.gravataPrecoCentavos===500))&&booking.servicoPrecoCentavos!=null){
     const v=booking.pagamentoVenda
     if(!v||v.status!=='concluida'||v.mercadoPagoStatus!=='approved'||!v.mercadoPagoId||/^SIM[-_]/.test(v.mercadoPagoId)||Math.round(v.total*100)!==booking.servicoPrecoCentavos+booking.gravataPrecoCentavos)return {error:'Aguarde o pagamento integral do agendamento antes de vincular.',status:409}
     await tx.processo.update({where:{id},data:{bookingRequestId:booking.id,valorServico:booking.servicoPrecoCentavos/100}})
     await tx.venda.update({where:{id:v.id},data:{comandaProcessoId:id}})
     return {ok:true}
    }
    await tx.processo.update({where:{id},data:{bookingRequestId:booking.id}})
    if(booking.gravataFoto&&booking.gravataPrecoCentavos===500){
     const tutor=booking.cliente.user
     if(!tutor)throw Error('Conta do tutor indisponível.')
     await tx.comandaServicoExtra.create({data:{processoId:id,chaveServico:'gravata-personalizada',nome:'Gravata personalizada com foto',precoCentavos:500,duracaoMinutos:0,motivo:'Personalização escolhida no agendamento.',origem:'tutor',status:'autorizado',solicitadoPorId:tutor.id,aceitoPorId:tutor.id,respondidoEm:booking.createdAt,equipePorId:ctx.user.id,equipeEm:new Date()}})
    }
    return {ok:true}
   }
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
   const extra=await tx.comandaServicoExtra.findFirst({where:{id:input.extraId,processoId:id},include:{venda:true,grupoVenda:{select:grupoSelect}}})
   if(!extra)return {error:'Adicional não encontrado.',status:404}
   if(input.action==='responder'){
    if(ctx.staff||(!['aguardando_tutor','autorizado'].includes(extra.status))||(!input.aceitar&&extra.status!=='aguardando_tutor'))return {error:'Apenas o tutor pode responder uma autorização pendente.',status:403}
    if(extra.status==='autorizado'&&extra.aceitoPorId!==ctx.user.id)return {error:'Autorização já registrada.',status:409}
    const atualizado=extra.status==='aguardando_tutor'?await tx.comandaServicoExtra.update({where:{id:extra.id},data:{status:input.aceitar?'autorizado':'recusado',aceitoPorId:ctx.user.id,respondidoEm:new Date()}}):extra
    if(!input.aceitar||extra.precoCentavos===0)return {extra:atualizado}
    if(extra.grupoVenda)return {extra:atualizado,venda:{id:extra.grupoVenda.id,total:extra.grupoVenda.total,status:extra.grupoVenda.status}}
    if(extra.venda?.status==='cancelada')return {error:'Cobrança cancelada. Solicite conciliação à equipe.',status:409}
    if(extra.venda)return {extra:atualizado,venda:{id:extra.venda.id,total:extra.venda.total,status:extra.venda.status}}
    const venda=await tx.venda.create({data:{clienteId:p.pet.clienteId,comandaProcessoId:id,canal:'site',status:'pendente',total:extra.precoCentavos/100,subtotalProdutos:0,observacoes:'Serviço adicional (NFS-e separada): '+extra.nome,tipoEntrega:'retirada',valorFrete:0},select:{id:true,total:true,status:true}})
    await tx.comandaServicoExtra.update({where:{id:extra.id},data:{vendaId:venda.id}})
    return {extra:atualizado,venda}
   }
   if(input.action==='confirmar-equipe'){
    if(!ctx.staff||extra.status!=='aguardando_equipe')return {error:'Ação não permitida.',status:403}
    return {extra:await tx.comandaServicoExtra.update({where:{id:extra.id},data:{status:input.aceitar?'autorizado':'recusado',equipePorId:ctx.user.id,equipeEm:new Date()}})}
   }
   if(input.action==='realizar'){
    if(!ctx.staff||!adicionalLiberado(extra))return {error:'Serviço exige aceite, confirmação da equipe e pagamento real aprovado.',status:409}
    return {extra:await tx.comandaServicoExtra.update({where:{id:extra.id},data:{status:'realizado',realizadoEm:new Date()}})}
   }
   if(!['autorizado','realizado'].includes(extra.status)||!extra.aceitoPorId||!extra.equipePorId||extra.precoCentavos<=0)return {error:'Adicional ainda não autorizado para cobrança.',status:409}
   if(extra.grupoVenda)return {venda:{id:extra.grupoVenda.id,total:extra.grupoVenda.total,status:extra.grupoVenda.status}}
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
