import { NextRequest, NextResponse } from 'next/server'
import { enqueueAppointmentReminders, dispatchPortalMessages } from '@/lib/portal-notifications'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=60
export async function GET(req:NextRequest) {
  const configured=process.env.CRON_SECRET?.trim()
  if(!configured || req.headers.get('authorization')!=='Bearer '+configured)
    return NextResponse.json({error:'Não autorizado.'},{status:401})
  if(process.env.PORTAL_NOTIFICATIONS_ENABLED!=='true')
    return NextResponse.json({enabled:false,queued:0,sent:0})
  try {
    const queued=await enqueueAppointmentReminders()
    const delivery=await dispatchPortalMessages()
    return NextResponse.json({enabled:true,queued,delivery})
  }catch(error){
    console.error('[cron/portal-notifications]',error)
    return NextResponse.json({error:'Falha ao processar notificações.'},{status:500})
  }
}
