import { NextResponse } from 'next/server'
import { portalCliente } from '@/lib/portal-care'
import { db } from '@/lib/db'
import { experienceError } from '@/lib/customer-experience'

export const dynamic='force-dynamic'
export async function GET() {
  try {
    await portalCliente()
    const items=await db.profissionalAgenda.findMany({
      where:{ativo:true},orderBy:{nome:'asc'},select:{id:true,nome:true},
    })
    return NextResponse.json({items},{headers:{'Cache-Control':'private, no-store'}})
  }catch(error){return experienceError(error)}
}
