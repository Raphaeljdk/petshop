import { createHmac, timingSafeEqual } from 'node:crypto'

function equal(a:string,b:string){
 const x=Buffer.from(a), y=Buffer.from(b)
 return x.length===y.length&&timingSafeEqual(x,y)
}
export function metaChallenge(params:URLSearchParams, token:string|undefined):string|null{
 const challenge=params.get('hub.challenge')
 if(!token||token.length<24||params.get('hub.mode')!=='subscribe'||!equal(params.get('hub.verify_token')||'',token)||!challenge||!/^\d{1,64}$/.test(challenge))return null
 return challenge
}
export function metaSignatureValid(body:Buffer,signature:string|null,secret:string|undefined){
 if(!secret||!signature||!/^sha256=[0-9a-f]{64}$/i.test(signature))return false
 return equal(signature.toLowerCase(),'sha256='+createHmac('sha256',secret).update(body).digest('hex'))
}
export const metaDeliveryTransitions={
 sent:{next:'enviado',from:['enviado']},
 delivered:{next:'entregue',from:['enviado','falha_entrega']},
 read:{next:'lido',from:['enviado','entregue','falha_entrega']},
 failed:{next:'falha_entrega',from:['enviado']},
} as const

export function extractMetaStatuses(payload:unknown,phoneId:string){
 const out:Array<{id:string;status:keyof typeof metaDeliveryTransitions}>=[]
 const p=payload as {object?:unknown;entry?:unknown}|null
 if(p?.object!=='whatsapp_business_account'||!Array.isArray(p.entry))return out
 for(const e of p.entry){
  if(!Array.isArray(e?.changes))continue
  for(const c of e.changes){
   if(c?.field!=='messages'||c.value?.metadata?.phone_number_id!==phoneId||!Array.isArray(c.value?.statuses))continue
   for(const s of c.value.statuses){
    if(typeof s?.id==='string'&&s.id.length>0&&s.id.length<=512&&typeof s.status==='string'&&Object.hasOwn(metaDeliveryTransitions,s.status))
      out.push({id:s.id,status:s.status as keyof typeof metaDeliveryTransitions})
   }
  }
 }
 return out
}
