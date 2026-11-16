import { NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { marketplaceSyncStatus,runMarketplacesSync } from '@/lib/marketplace-auto-sync'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300

async function admin(){
  const user=await getUsuarioLogado()
  return user?.role==='ADMIN'
}
export async function GET(){
  if(!await admin())return NextResponse.json({error:'Acesso negado'},{status:403})
  return NextResponse.json({enabled:true,intervalMinutes:30,
    status:await marketplaceSyncStatus()},{headers:{'Cache-Control':'private, no-store'}})
}
export async function POST(){
  if(!await admin())return NextResponse.json({error:'Acesso negado'},{status:403})
  try{
    const result=await runMarketplacesSync()
    return NextResponse.json(result,{status:result.ok?200:207,
      headers:{'Cache-Control':'private, no-store'}})
  }catch(error){
    console.error('[marketplace/sync] erro',error)
    return NextResponse.json({error:'Falha na sincronização. Consulte o histórico da integração.'},{status:503})
  }
}
