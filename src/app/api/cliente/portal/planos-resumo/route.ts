import { NextResponse } from 'next/server'
import { portalCliente } from '@/lib/portal-care'
import { db } from '@/lib/db'
import { experienceError } from '@/lib/customer-experience'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { clienteId } = await portalCliente()
    const rows = await db.portalCarePlanRequest.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id:true,petKey:true,status:true,expiresAt:true,sessionsUsed:true,
        plan:{ select:{ title:true,sessions:true } },
      },
    })
    const now = new Date()
    const items = rows.map(row => {
      const active = row.status === 'ativo' && (!row.expiresAt || row.expiresAt > now)
      const remaining = active ? Math.max(0,row.plan.sessions - row.sessionsUsed) : 0
      return {
        id:row.id,petKey:row.petKey,planTitle:row.plan.title,
        status:row.status === 'ativo' && row.expiresAt && row.expiresAt <= now ? 'vencido' : row.status,
        sessions:row.plan.sessions,used:row.sessionsUsed,remaining,expiresAt:row.expiresAt,
      }
    })
    return NextResponse.json({ items, totalRemaining:items.reduce((n,row)=>n+row.remaining,0) },
      { headers:{'Cache-Control':'private, no-store'} })
  } catch(error){return experienceError(error)}
}
