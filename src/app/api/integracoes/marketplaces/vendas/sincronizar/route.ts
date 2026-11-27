import { NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { marketplaceSyncStatus,runMarketplacesSync } from '@/lib/marketplace-auto-sync'
import { stockWritesEnabled } from '@/lib/marketplace-stock-safety'
import { db } from '@/lib/db'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300

async function admin(){
  const user=await getUsuarioLogado()
  return user?.role==='ADMIN'
}
export async function GET(){
  if(!await admin())return NextResponse.json({error:'Acesso negado'},{status:403})
  const [status,issues]=await Promise.all([
    marketplaceSyncStatus(),
    db.marketplaceStockIssue.findMany({where:{resolvedAt:null},
      orderBy:{updatedAt:'desc'},take:12,select:{channel:true,title:true,category:true,
        error:true,retryAfter:true,updatedAt:true}}),
  ])
  return NextResponse.json({enabled:true,stockWritesEnabled:stockWritesEnabled(),intervalMinutes:null,mode:'eventos',status,issues},
    {headers:{'Cache-Control':'private, no-store'}})
}
export async function POST(){
  if(!await admin())return NextResponse.json({error:'Acesso negado'},{status:403})
  try{
    const result=await runMarketplacesSync({force:true})
    return NextResponse.json(result,{status:result.ok?200:207,
      headers:{'Cache-Control':'private, no-store'}})
  }catch(error){
    console.error('[marketplace/sync] erro',error)
    return NextResponse.json({error:'Falha na sincronização. Consulte o histórico da integração.'},{status:503})
  }
}
