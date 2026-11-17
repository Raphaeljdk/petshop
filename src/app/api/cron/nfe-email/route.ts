import {NextRequest,NextResponse} from 'next/server'
import {enqueueNfeEmails,dispatchNfeEmails} from '@/lib/fiscal-nfe-email'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60

export async function GET(req:NextRequest){
 const configured=process.env.CRON_SECRET?.trim()
 if(!configured||req.headers.get('authorization')!=='Bearer '+configured)
  return NextResponse.json({error:'Não autorizado.'},{status:401})
 // O fluxo fiscal REAL permanece bloqueado até homologação e aprovação.
 if(process.env.NFE_EMAIL_AUTOMATICO_ENABLED!=='true')
  return NextResponse.json({enabled:false,enfileiradas:0,enviadas:0})
 try{
  const q=await enqueueNfeEmails()
  const envio=await dispatchNfeEmails()
  return NextResponse.json({enabled:true,...q,...envio})
 }catch(err){
  console.error('[cron/nfe-email] falha ao processar entrega fiscal',err instanceof Error?err.name:'erro')
  return NextResponse.json({error:'Falha no processamento de e-mails fiscais.'},{status:500})
 }
}
