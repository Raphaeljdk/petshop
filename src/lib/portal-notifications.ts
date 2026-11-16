import { db } from '@/lib/db'
import { invitationMailConfig } from '@/lib/client-invitations'

// Explicit opt-in, idempotent queue and an authenticated Vercel cron.
// Email uses the existing Resend setup; WhatsApp only approved Cloud API templates.
function whatsappConfig(){
  const token=process.env.META_WHATSAPP_ACCESS_TOKEN?.trim()
  const phone=process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim()
  const template=process.env.META_WHATSAPP_TEMPLATE_APPOINTMENT?.trim()
  const version=process.env.META_WHATSAPP_GRAPH_VERSION?.trim()
  return {token,phone,template,version,ready:Boolean(token&&phone&&template&&/^v[0-9]+\.[0-9]+$/.test(version||''))}
}
function phoneBR(value:string){
  const digits=value.replace(/\D/g,'')
  if(/^55[1-9][0-9]{9,10}$/.test(digits))return digits
  if(/^[1-9][0-9]{9,10}$/.test(digits))return '55'+digits
  return null
}
export async function enqueueAppointmentReminders(now=new Date()){
  const lower=new Date(now.getTime()+18*3600000)
  const upper=new Date(now.getTime()+42*3600000)
  const rows=await db.agendamento.findMany({where:{
    dataHora:{gte:lower,lte:upper},status:{in:['agendado','confirmado']},
  },include:{pet:{select:{nome:true}},cliente:{select:{id:true,nome:true}}},take:150})
  let queued=0
  for(const row of rows){
    const preferences=await db.portalClientPreferences.findUnique({where:{clienteId:row.clienteId}})
    if(!preferences)continue
    const stamp=row.dataHora.toISOString().slice(0,10)
    const message='Olá, '+row.cliente.nome+'! Lembrete Matilha Prado: '+row.pet.nome+
      ' tem '+row.servico+' em '+row.dataHora.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+'.'
    for(const [channel,enabled] of [
      ['app',preferences.remindersInApp],
      ['email',preferences.remindersEmail],
      ['whatsapp',preferences.remindersWhatsapp],
    ] as Array<[string,boolean]>){
      if(!enabled)continue
      const key='appointment:'+row.id+':'+stamp+':'+channel
      const record=await db.portalMessageDelivery.createMany({data:[{
        uniqueKey:key,clienteId:row.clienteId,channel,kind:'agendamento',
        text:message,templateName:channel==='whatsapp'?'appointment_reminder':null,
        status:channel==='app'?'enviado':'pendente',
        sentAt:channel==='app'?now:null,
      }],skipDuplicates:true})
      queued+=record.count
    }
  }
  return {queued,appointments:rows.length}
}
async function sendEmail(to:string,delivery:{uniqueKey:string;text:string}){
  const config=invitationMailConfig()
  if(!config.configured)throw Error('Resend indisponível')
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{
    Authorization:'Bearer '+config.key,'Content-Type':'application/json',
    'Idempotency-Key':'portal-'+delivery.uniqueKey,
  },body:JSON.stringify({
    from:config.from,to:[to],subject:'Lembrete de agendamento | Matilha Prado',
    text:delivery.text,...(config.replyTo?{reply_to:config.replyTo}:{}),
  }),signal:AbortSignal.timeout(10000)})
  const json=await response.json().catch(()=>null)
  if(!response.ok||!json?.id)throw Error('Resend não confirmou entrega HTTP '+response.status)
  return String(json.id)
}
async function sendWhatsApp(to:string,delivery:{text:string}){
  const conf=whatsappConfig()
  if(!conf.ready)throw Error('WhatsApp Cloud API não configurada com template aprovado')
  const phone=phoneBR(to)
  if(!phone)throw Error('Número de WhatsApp inválido')
  // Approved template must contain ONE body placeholder for the concise reminder.
  const response=await fetch('https://graph.facebook.com/'+conf.version+'/'+conf.phone+'/messages',{
    method:'POST',headers:{Authorization:'Bearer '+conf.token,'Content-Type':'application/json'},
    body:JSON.stringify({messaging_product:'whatsapp',to:phone,type:'template',
      template:{name:conf.template,language:{code:'pt_BR'},components:[{
        type:'body',parameters:[{type:'text',text:delivery.text.slice(0,500)}],
      }]}}),signal:AbortSignal.timeout(10000),
  })
  const json=await response.json().catch(()=>null)
  if(!response.ok||!json?.messages?.[0]?.id)throw Error('WhatsApp não confirmou envio HTTP '+response.status)
  return String(json.messages[0].id)
}
export async function dispatchPortalMessages(){
  const rows=await db.portalMessageDelivery.findMany({where:{
    status:'pendente',nextAttemptAt:{lte:new Date()},attempts:{lt:3},
  },orderBy:{createdAt:'asc'},take:40})
  let sent=0,errors=0
  for(const row of rows){
    const now=new Date()
    const claimed=await db.portalMessageDelivery.updateMany({where:{
      id:row.id,status:'pendente',
    },data:{status:'enviando',attempts:{increment:1}}})
    if(!claimed.count)continue
    const prefs=await db.portalClientPreferences.findUnique({where:{clienteId:row.clienteId}})
    const allowed=row.channel==='email' ? prefs?.remindersEmail :row.channel==='whatsapp'?prefs?.remindersWhatsapp:false
    if(!allowed){
      await db.portalMessageDelivery.update({where:{id:row.id},data:{status:'cancelado'}})
      continue
    }
    const client=await db.cliente.findUnique({where:{id:row.clienteId},select:{email:true,telefone:true}})
    try{
      const id=row.channel==='email'
        ?await sendEmail(client?.email?.trim()||'',row)
        :await sendWhatsApp(client?.telefone||'',row)
      await db.portalMessageDelivery.update({where:{id:row.id},data:{
        status:'enviado',sentAt:now,providerId:id,
      }})
      sent++
    }catch(e){
      console.error('[portal-messages] envio não confirmado:',row.id,e instanceof Error?e.message:'erro')
      // Avoid automated duplicate WhatsApp sends on ambiguous timeout: manual inspection required.
      const retryable=row.channel==='email' && row.attempts+1<3
      await db.portalMessageDelivery.update({where:{id:row.id},data:{
        status:retryable?'pendente':'erro',nextAttemptAt:new Date(Date.now()+60*60*1000),
      }})
      errors++
    }
  }
  return {processed:rows.length,sent,errors}
}
