import {db} from '@/lib/db'
import {MATILHA_CONTACT} from '@/lib/matilha-contact'
import {getOuCriarConfigPagamento} from '@/lib/mercado-pago'
import {consultarOrderMercadoPago} from '@/lib/mercado-pago-orders'
import {gravataPaga,confirmacaoReal} from './gravata-whatsapp-policy'

function config(){
 const token=process.env.META_WHATSAPP_ACCESS_TOKEN?.trim()
 const phone=process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim()
 const sender=process.env.META_WHATSAPP_SENDER_NUMBER?.replace(/\D/g,'')
 const template=process.env.META_WHATSAPP_TEMPLATE_GRAVATA?.trim()
 const templateTexto=process.env.META_WHATSAPP_TEMPLATE_GRAVATA_TEXTO?.trim()
 const version=process.env.META_WHATSAPP_GRAPH_VERSION?.trim()
 const to=MATILHA_CONTACT.whatsappNumber
 return {token,phone,sender,template,templateTexto,version,to,ready:Boolean(token&&phone&&((template&&/^[a-z0-9_]+$/.test(template))||(templateTexto&&/^[a-z0-9_]+$/.test(templateTexto)))&&/^v\d+\.\d+$/.test(version||'')&&sender&&/^\d{10,15}$/.test(sender)&&sender!==to)}
}
export function gravataWhatsConfigStatus(){const c=config();return {configured:c.ready,templateConfigured:!!c.template,senderConfigured:!!c.sender,senderDistinct:!!c.sender&&c.sender!==c.to}}
export async function dispatchGravataPaga(vendaId:string){
 const c=config()
 if(!c.ready)return {status:'nao_configurado'}
 const b=await db.bookingRequest.findUnique({where:{pagamentoVendaId:vendaId},include:{pagamentoVenda:true,cliente:{select:{nome:true}}}})
 const venda=b?.pagamentoVenda
 if(!b||!venda||!gravataPaga(b,venda)||!['aguardando_pagamento','pendente'].includes(b.gravataWhatsStatus))return {status:'ignorado'}
 const modelo=b.gravataFoto?c.template:c.templateTexto
 if(!modelo||!/^[a-z0-9_]+$/.test(modelo))return {status:'modelo_nao_configurado'}
 const gateway=await getOuCriarConfigPagamento()
 const gatewayToken=process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim()||gateway.mercadoPagoAccessToken?.trim()
 if(gateway.mercadoPagoSandbox||!gatewayToken||gatewayToken.startsWith('TEST-'))return {status:'pagamento_nao_real'}
 const order=await consultarOrderMercadoPago(venda.mercadoPagoId!,gateway)
 if(!confirmacaoReal(order,venda))return {status:'pagamento_nao_confirmado'}
 // Um único executor por agendamento. Se o envio ficar ambíguo, requer conferência manual.
 const claim=await db.bookingRequest.updateMany({where:{id:b.id,status:'confirmado',gravataWhatsStatus:{in:['aguardando_pagamento','pendente']},pagamentoVenda:{is:{id:venda.id,status:'concluida',mercadoPagoStatus:'approved'}}},data:{gravataWhatsStatus:'enviando'}})
 if(!claim.count)return {status:'ignorado'}
 let sending=false
 try{
  const base='https://graph.facebook.com/'+c.version+'/'+c.phone
  let mediaId:string|undefined
  if(b.gravataFoto){
  const match=b.gravataFoto.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/)
  if(!match)throw Error('Imagem inválida.')
  const bytes=Buffer.from(match[2],'base64')
  if(!bytes.length||bytes.length>300000)throw Error('Imagem fora dos limites.')
  const mime='image/'+match[1]
  const form=new FormData()
  form.append('messaging_product','whatsapp')
  form.append('type',mime)
  form.append('file',new Blob([new Uint8Array(bytes)],{type:mime}),'gravata.'+match[1])
  const media=await fetch(base+'/media',{method:'POST',headers:{Authorization:'Bearer '+c.token},body:form,signal:AbortSignal.timeout(10000)})
  const uploaded=await media.json().catch(()=>null)
  if(!media.ok||!uploaded?.id)throw Error('Não foi possível enviar mídia.')
  mediaId=String(uploaded.id)
  }
  const descricao=[b.gravataNome?'Nome: '+b.gravataNome:'',b.gravataIdeia||''].filter(Boolean).join(' · ')||'Sem sugestão adicional'
  const fields=[b.cliente.nome,b.petName,descricao,b.id].map(t=>({type:'text',text:t.replace(/[\r\n\t]+/g,' ').trim().slice(0,400)||'Não informado'}))
  const stillPaid=await db.bookingRequest.findUnique({where:{id:b.id},include:{pagamentoVenda:true}})
  if(!stillPaid||!gravataPaga(stillPaid,stillPaid.pagamentoVenda)){await db.bookingRequest.updateMany({where:{id:b.id,gravataWhatsStatus:'enviando'},data:{gravataWhatsStatus:'aguardando_pagamento'}});return {status:'pagamento_alterado'}}
  sending=true
  const response=await fetch(base+'/messages',{method:'POST',headers:{Authorization:'Bearer '+c.token,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:c.to,type:'template',template:{name:modelo,language:{code:'pt_BR'},components:[...(mediaId?[{type:'header',parameters:[{type:'image',image:{id:mediaId}}]}]:[]),{type:'body',parameters:fields}]}}),signal:AbortSignal.timeout(10000)})
  const body=await response.json().catch(()=>null)
  if(!response.ok||!body?.messages?.[0]?.id)throw Error('Meta não confirmou recebimento.')
  await db.bookingRequest.update({where:{id:b.id},data:{gravataWhatsStatus:'enviado',gravataWhatsId:String(body.messages[0].id),gravataWhatsEnviadoEm:new Date()}})
  return {status:'enviado'}
 }catch(e){
  await db.bookingRequest.updateMany({where:{id:b.id,gravataWhatsStatus:'enviando'},data:{gravataWhatsStatus:sending?'conferir_envio':'pendente'}})
  console.error('[gravata-whatsapp] envio não confirmado',e instanceof Error?e.name:'erro')
  return {status:sending?'conferir_envio':'pendente'}
 }
}
export async function dispatchGravatasPendentes(){
 if(!config().ready)return {configured:false,processed:0}
 const bookings=await db.bookingRequest.findMany({where:{status:'confirmado',OR:[{gravataFoto:{not:null}},{gravataNome:{not:null}}],gravataWhatsStatus:{in:['aguardando_pagamento','pendente']},pagamentoVenda:{is:{status:'concluida',mercadoPagoStatus:'approved'}}},select:{pagamentoVendaId:true},take:10})
 let sent=0
 for(const b of bookings){if(!b.pagamentoVendaId)continue;try{if((await dispatchGravataPaga(b.pagamentoVendaId)).status==='enviado')sent++}catch(e){console.error('[gravata-whatsapp] conciliação pendente')}}
 return {configured:true,processed:bookings.length,sent}
}
