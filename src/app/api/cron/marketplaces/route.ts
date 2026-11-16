import { NextRequest,NextResponse } from 'next/server'
import { runMarketplacesSync } from '@/lib/marketplace-auto-sync'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300

export async function GET(req:NextRequest){
  const secret=process.env.CRON_SECRET?.trim()
  if(!secret || req.headers.get('authorization')!=='Bearer '+secret)
    return NextResponse.json({error:'Não autorizado.'},{status:401})
  try{
    const result=await runMarketplacesSync()
    return NextResponse.json(result,{status:result.ok?200:207,
      headers:{'Cache-Control':'private, no-store'}})
  }catch(error){
    console.error('[cron/marketplaces] falha',error)
    return NextResponse.json({ok:false,error:'Falha ao sincronizar marketplaces.'},{status:503})
  }
}
