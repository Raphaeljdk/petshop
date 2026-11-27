import {db} from '@/lib/db'
import {invitationMailConfig} from '@/lib/client-invitations'
import {gerarDanfeAutorizado} from './nfe-danfe'
import {emailSchema} from '@/lib/auth-validation'
import {numeroPedidoAmazon} from './nfe-real-venda'

/**
 * Envia somente NF-e REAL modelo 55 de emissão própria da Matilha Prado,
 * autorizada pela SEFAZ com protocolo e XML nfeProc de tpAmb=1.
 * Não envia notas em homologação, rejeitadas ou de emissores externos.
 */
export type NfeParaEmail={
 modelo:string;status:string;emissor:string|null;chaveAcesso:string|null
 protocolo:string|null;xmlAutorizado:string|null
}
const tag=(xml:string,name:string)=>{
 const safe=name.replace(/[^A-Za-z]/g,'')
 const found=xml.match(new RegExp('<(?:[A-Za-z][\\w.-]*:)?'+safe+'>([^<>]*)<\\/(?:[A-Za-z][\\w.-]*:)?'+safe+'>'))
 return found?.[1]?.trim()||null
}
export function nfeRealAutorizadaParaEmail(n:NfeParaEmail):boolean{
 if(n.modelo!=='55'||n.status!=='autorizada'||n.emissor!=='matilha_prado'||
   !/^\d{44}$/.test(n.chaveAcesso||'')||!/^\d{15}$/.test(n.protocolo||'')||
   !n.xmlAutorizado||n.xmlAutorizado.length>500_000) return false
 const xml=n.xmlAutorizado
 if(!/<(?:\w+:)?nfeProc\b/.test(xml)||/<!DOCTYPE|<!ENTITY/i.test(xml)||
   !xml.includes('Id="NFe'+n.chaveAcesso+'"'))return false
 const match=xml.match(/<(?:\w+:)?protNFe\b[^>]*>[\s\S]*?<\/(?:\w+:)?protNFe\s*>/)
 if(!match)return false
 const prot=match[0]
 return tag(xml.slice(0,match.index),'tpAmb')==='1'&&tag(prot,'tpAmb')==='1'&&
  ['100','150'].includes(tag(prot,'cStat')||'')&&
  tag(prot,'chNFe')===n.chaveAcesso&&tag(prot,'nProt')===n.protocolo
}

export function emailParaEntrega(venda:{canal:string;cliente:{email:string|null}|null},dadosOperacao:unknown){
 const email=venda.canal==='amazon'&&dadosOperacao&&typeof dadosOperacao==='object'&&'emailPedidoAmazon' in dadosOperacao
  ?dadosOperacao.emailPedidoAmazon:venda.cliente?.email
 return emailSchema.safeParse(email)
}

export async function enqueueNfeEmails(){
 // Não descobrir notas de outro emissor, mesmo se tiverem XML autorizado.
 const notas=await db.notaFiscal.findMany({where:{
  modelo:'55',status:'autorizada',emissor:'matilha_prado',entregaEmail:null,
  chaveAcesso:{not:null},protocolo:{not:null},xmlAutorizado:{not:null},
 },select:{
  id:true,modelo:true,status:true,emissor:true,chaveAcesso:true,protocolo:true,xmlAutorizado:true,
  venda:{select:{canal:true,cliente:{select:{email:true}},reservaNfe:{select:{dadosOperacao:true}}}},
 },take:60,orderBy:{autorizadaEm:'desc'}})
 let enfileiradas=0
 for(const nota of notas){
  const endereco=emailParaEntrega(nota.venda,nota.venda.reservaNfe?.dadosOperacao)
  if(!endereco.success||!nfeRealAutorizadaParaEmail(nota))continue
  const created=await db.nfeEmailDelivery.createMany({data:[{
   notaFiscalId:nota.id,destinatarioEmail:endereco.data,
  }],skipDuplicates:true})
  enfileiradas+=created.count
 }
 return {enfileiradas}
}

export function configuracaoEmailFiscal(){
 const mail=invitationMailConfig()
 const from=process.env.RESEND_FROM_EMAIL?.trim()||mail.from
 return {...mail,from,configured:Boolean(mail.key&&from)}
}
export async function dispatchNfeEmails(enviar:typeof fetch=fetch,cfg=configuracaoEmailFiscal(),notaFiscalId?:string){
 if(!cfg.configured) return {enviadas:0,erros:0,indisponivel:true}
 const agora=Date.now(), janela=new Date(agora-23*3600_000), espera=new Date(agora-5*60_000)
 const entregas=await db.nfeEmailDelivery.findMany({where:{...(notaFiscalId?{notaFiscalId}:{}),OR:[
  {status:'pendente'}, {status:{in:['enviando','tentar_novamente']},createdAt:{gt:janela},attemptedAt:{lt:espera}},
 ]},
  orderBy:{createdAt:'asc'},take:20})
 let enviadas=0,erros=0
 for(const entrega of entregas){
  const claimed=await db.nfeEmailDelivery.updateMany({
   where:{id:entrega.id,status:entrega.status,attemptedAt:entrega.attemptedAt},
   data:{status:'enviando',attemptedAt:new Date()},
  })
  if(claimed.count!==1)continue
  let podeRepetir=false
  try{
   const nota=await db.notaFiscal.findUnique({where:{id:entrega.notaFiscalId},select:{
    modelo:true,status:true,emissor:true,chaveAcesso:true,protocolo:true,xmlAutorizado:true,
    numero:true,serie:true,
    venda:{select:{canal:true,marketplaceOrderId:true,cliente:{select:{nome:true,email:true}},reservaNfe:{select:{dadosOperacao:true}}}},
   }})
   if(!nota||!nfeRealAutorizadaParaEmail(nota))throw Error('NF-e autorizada indisponível.')
   const email=emailParaEntrega(nota.venda,nota.venda.reservaNfe?.dadosOperacao)
   if(!email.success||email.data.toLowerCase()!==entrega.destinatarioEmail.toLowerCase())
    throw Error('Nota ou e-mail não corresponde a documento real autorizado.')
   const nome=nota.venda.cliente?.nome?.trim()||'cliente'
   const chave=nota.chaveAcesso as string
   const xml=nota.xmlAutorizado as string
   const pedido=nota.venda.canal==='amazon'?numeroPedidoAmazon(nota.venda.marketplaceOrderId):null
   const emailBody='Olá, '+nome+'!\n\nSua NF-e da Matilha Prado foi autorizada pela SEFAZ.'+
    (pedido?'\nPedido Amazon: '+pedido:'')+
    '\nNúmero: '+(nota.numero??'')+' | Série: '+(nota.serie??'')+
    '\nChave de acesso: '+chave+
    '\n\nO XML autorizado e o DANFE em PDF estão anexados a este e-mail. Guarde o documento para seus registros.'+
    '\n\nEquipe Matilha Prado'
   const pdf=gerarDanfeAutorizado(xml).toString('base64')
   podeRepetir=true
   const response=await enviar('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:'Bearer '+cfg.key,'Content-Type':'application/json',
     'Idempotency-Key':'nfe-autorizada-'+entrega.notaFiscalId},
    body:JSON.stringify({
     from:cfg.from,to:[email.data],subject:pedido?'NF-e do pedido Amazon '+pedido:'Sua NF-e autorizada | Matilha Prado',
     text:emailBody,...(cfg.replyTo?{reply_to:cfg.replyTo}:{}),
     attachments:[{filename:'DANFE-'+chave+'.pdf',content:pdf},{
      filename:'NFe-'+chave+'.xml',content:Buffer.from(xml,'utf8').toString('base64'),
     }],
    }),
    signal:AbortSignal.timeout(12000),
   })
   podeRepetir=response.status>=500||[408,429].includes(response.status)||response.ok
   const resposta=await response.json().catch(()=>null)
   if(!response.ok||typeof resposta?.id!=='string')
    throw Error('Provedor não confirmou o envio HTTP '+response.status)
   await db.nfeEmailDelivery.update({where:{id:entrega.id},data:{
    status:'enviado',providerId:resposta.id,sentAt:new Date(),
   }})
   enviadas++
  }catch(err){
   // Reutilizar a mesma chave dentro da janela de idempotência do provedor.
   console.error('[nfe-email] envio não confirmado',entrega.id,
    err instanceof Error?err.message:'erro desconhecido')
   await db.nfeEmailDelivery.update({where:{id:entrega.id},data:{status:podeRepetir&&entrega.createdAt>janela?'tentar_novamente':'erro'}})
   erros++
  }
 }
 return {enviadas,erros,indisponivel:false}
}
