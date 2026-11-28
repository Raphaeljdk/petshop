import {NextRequest,NextResponse} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {getUsuarioLogado} from '@/lib/auth-helpers'
import {experienceBody,experienceError} from '@/lib/customer-experience'
import {getOuCriarConfigPagamento} from '@/lib/mercado-pago'
import {checkoutTransparenteConfigurado} from '@/lib/mercado-pago-orders'

export const dynamic='force-dynamic'
export async function POST(req:NextRequest){
 try{
  const user=await getUsuarioLogado()
  if(!user?.cliente)return NextResponse.json({error:'Não autenticado.'},{status:401})
  const {id}=z.object({id:z.string().min(1).max(100)}).strict().parse(await experienceBody(req))
  const config=await getOuCriarConfigPagamento()
  const token=process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim()||config.mercadoPagoAccessToken?.trim()
  if(!checkoutTransparenteConfigurado(config)||config.mercadoPagoSandbox||!token||token.startsWith('TEST-'))return NextResponse.json({error:'Pagamento real indisponível.'},{status:503})
  const clienteId=user.cliente.id
  const result=await db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'booking-payment:'+id}))`
   const b=await tx.bookingRequest.findFirst({where:{id,clienteId,status:'confirmado'},include:{pagamentoVenda:true,processo:{select:{id:true}}}})
   if(!b||(!b.pagamentoOnlineObrigatorio&&(!b.gravataFoto||b.gravataPrecoCentavos!==500))||b.servicoPrecoCentavos==null||b.servicoPrecoCentavos<=0)return {error:'Agendamento sem preço confirmado ou sem pagamento online habilitado.',status:409}
   if(b.pagamentoVenda){
    if(b.pagamentoVenda.status==='cancelada')return {error:'Pagamento cancelado. Solicite conciliação à equipe antes de tentar novamente.',status:409}
    return {id:b.pagamentoVenda.id,total:b.pagamentoVenda.total,status:b.pagamentoVenda.status}
   }
   if(b.processo||!b.confirmedAt||b.confirmedAt<=new Date())return {error:'Consulte a equipe para o pagamento de um atendimento já iniciado.',status:409}
   const venda=await tx.venda.create({data:{clienteId,canal:'site',status:'pendente',total:(b.servicoPrecoCentavos+b.gravataPrecoCentavos)/100,subtotalProdutos:0,tipoEntrega:'retirada',valorFrete:0,observacoes:'Agendamento'+(b.gravataPrecoCentavos?' e gravata personalizada':'')+' — serviços (NFS-e separada)'},select:{id:true,total:true,status:true}})
   await tx.bookingRequest.update({where:{id:b.id},data:{pagamentoVendaId:venda.id}})
   return venda
  },{isolationLevel:'Serializable'})
  if('error'in result && typeof result.status==='number')return NextResponse.json({error:result.error},{status:result.status})
  return NextResponse.json(result)
 }catch(e){return experienceError(e)}
}
