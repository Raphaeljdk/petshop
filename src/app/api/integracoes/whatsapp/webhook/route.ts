import { NextRequest,NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { metaChallenge,metaSignatureValid,extractMetaStatuses,metaDeliveryTransitions } from '@/lib/meta-whatsapp-webhook'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const headers={'Cache-Control':'no-store'}
export async function GET(req:NextRequest){
 const token=process.env.META_WHATSAPP_VERIFY_TOKEN?.trim()
 const challenge=metaChallenge(req.nextUrl.searchParams,token)
 if(challenge===null)return new NextResponse('Forbidden',{status:403,headers})
 return new NextResponse(challenge,{status:200,headers:{...headers,'Content-Type':'text/plain'}})
}
export async function POST(req:NextRequest){
 const secret=process.env.META_WHATSAPP_APP_SECRET?.trim()
 const phone=process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim()
 if(!secret||!phone)return NextResponse.json({error:'Webhook indisponível.'},{status:503,headers})
 const size=Number(req.headers.get('content-length')||0)
 if(size>1048576)return NextResponse.json({error:'Payload excede o limite.'},{status:413,headers})
 try{
  const reader=req.body?.getReader()
  const chunks:Uint8Array[]=[]
  let n=0
  if(reader)while(true){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>1048576){await reader.cancel();return NextResponse.json({error:'Payload excede o limite.'},{status:413,headers})}chunks.push(value)}
  const body=Buffer.concat(chunks)
  if(!metaSignatureValid(body,req.headers.get('x-hub-signature-256'),secret))return NextResponse.json({error:'Assinatura inválida.'},{status:401,headers})
  let payload:unknown
  try{payload=JSON.parse(body.toString('utf8'))}catch{return NextResponse.json({error:'JSON inválido.'},{status:400,headers})}
  for(const item of extractMetaStatuses(payload,phone)){
   const t=metaDeliveryTransitions[item.status]
   await db.bookingRequest.updateMany({where:{gravataWhatsId:item.id,gravataWhatsStatus:{in:[...t.from]}},data:{gravataWhatsStatus:t.next}})
  }
  // Não armazenamos textos, fotos recebidas ou números de telefone neste webhook.
  return NextResponse.json({ok:true},{headers})
 }catch{console.error('[meta-whatsapp] falha ao processar status');return NextResponse.json({error:'Falha temporária.'},{status:503,headers})}
}
