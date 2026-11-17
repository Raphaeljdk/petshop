import {db} from '@/lib/db'
import {invitationMailConfig} from '@/lib/client-invitations'
import {emailSchema} from '@/lib/auth-validation'

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
 return tag(prot,'tpAmb')==='1'&&
  ['100','150'].includes(tag(prot,'cStat')||'')&&
  tag(prot,'chNFe')===n.chaveAcesso&&tag(prot,'nProt')===n.protocolo
}

export async function enqueueNfeEmails(){
 // Segurança: esse emissor de produção ainda NÃO está liberado.
 // Não descobrir notas de outro emissor, mesmo se tiverem XML autorizado.
 const notas=await db.notaFiscal.findMany({where:{
  modelo:'55',status:'autorizada',emissor:'matilha_prado',
  chaveAcesso:{not:null},protocolo:{not:null},xmlAutorizado:{not:null},
 },select:{
  id:true,modelo:true,status:true,emissor:true,chaveAcesso:true,protocolo:true,xmlAutorizado:true,
  venda:{select:{cliente:{select:{email:true}}}},
 },take:60,orderBy:{autorizadaEm:'desc'}})
 let enfileiradas=0
 for(const nota of notas){
  const endereco=emailSchema.safeParse(nota.venda.cliente?.email)
  if(!endereco.success||!nfeRealAutorizadaParaEmail(nota))continue
  const created=await db.nfeEmailDelivery.createMany({data:[{
   notaFiscalId:nota.id,destinatarioEmail:endereco.data,
  }],skipDuplicates:true})
  enfileiradas+=created.count
 }
 return {enfileiradas}
}

export async function dispatchNfeEmails(){
 const cfg=invitationMailConfig()
 if(!cfg.configured) return {enviadas:0,erros:0,indisponivel:true}
 const entregas=await db.nfeEmailDelivery.findMany({where:{status:'pendente'},
  orderBy:{createdAt:'asc'},take:20})
 let enviadas=0,erros=0
 for(const entrega of entregas){
  const claimed=await db.nfeEmailDelivery.updateMany({
   where:{id:entrega.id,status:'pendente'},
   data:{status:'enviando',attemptedAt:new Date()},
  })
  if(claimed.count!==1)continue
  try{
   const nota=await db.notaFiscal.findUnique({where:{id:entrega.notaFiscalId},select:{
    modelo:true,status:true,emissor:true,chaveAcesso:true,protocolo:true,xmlAutorizado:true,
    numero:true,serie:true,
    venda:{select:{cliente:{select:{nome:true,email:true}}}},
   }})
   const email=emailSchema.safeParse(nota?.venda.cliente?.email)
   if(!nota||!nfeRealAutorizadaParaEmail(nota)||!email.success||
     email.data.toLowerCase()!==entrega.destinatarioEmail.toLowerCase())
    throw Error('Nota ou e-mail não corresponde a documento real autorizado.')
   const nome=nota.venda.cliente?.nome?.trim()||'cliente'
   const chave=nota.chaveAcesso as string
   const xml=nota.xmlAutorizado as string
   const emailBody='Olá, '+nome+'!\n\nSua NF-e da Matilha Prado foi autorizada pela SEFAZ.'+
    '\nNúmero: '+(nota.numero??'')+' | Série: '+(nota.serie??'')+
    '\nChave de acesso: '+chave+
    '\n\nO XML autorizado está anexado a este e-mail. Guarde o documento para seus registros.'+
    '\n\nEquipe Matilha Prado'
   const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:'Bearer '+cfg.key,'Content-Type':'application/json',
     'Idempotency-Key':'nfe-autorizada-'+entrega.notaFiscalId},
    body:JSON.stringify({
     from:cfg.from,to:[email.data],subject:'Sua NF-e autorizada | Matilha Prado',
     text:emailBody,...(cfg.replyTo?{reply_to:cfg.replyTo}:{}),
     attachments:[{
      filename:'NFe-'+chave+'.xml',content:Buffer.from(xml,'utf8').toString('base64'),
     }],
    }),
    signal:AbortSignal.timeout(12000),
   })
   const resposta=await response.json().catch(()=>null)
   if(!response.ok||typeof resposta?.id!=='string')
    throw Error('Provedor não confirmou o envio HTTP '+response.status)
   await db.nfeEmailDelivery.update({where:{id:entrega.id},data:{
    status:'enviado',providerId:resposta.id,sentAt:new Date(),
   }})
   enviadas++
  }catch(err){
   // Sem reenvio automático depois de resposta incerta; revisar no Resend primeiro.
   console.error('[nfe-email] envio não confirmado',entrega.id,
    err instanceof Error?err.message:'erro desconhecido')
   await db.nfeEmailDelivery.update({where:{id:entrega.id},data:{status:'erro'}})
   erros++
  }
 }
 return {enviadas,erros,indisponivel:false}
}
