import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { portalCliente } from '@/lib/portal-care'
import { experienceError } from '@/lib/customer-experience'
import { assertSameOrigin } from '@/lib/auth-http'
export const dynamic='force-dynamic'
export async function GET() {
  try {
    const {clienteId}=await portalCliente()
    const preferences=await db.portalClientPreferences.findUnique({
      where:{clienteId},select:{termsAcceptedAt:true},
    })
    return NextResponse.json({acceptedAt:preferences?.termsAcceptedAt||null},{
      headers:{'Cache-Control':'private, no-store'},
    })
  }catch(error){return experienceError(error)}
}
export async function POST(req:NextRequest) {
  try {
    const {clienteId}=await portalCliente()
    assertSameOrigin(req)
    const body=await req.json()
    if(!body || body.accepted!==true || Object.keys(body).some(key=>key!=='accepted')) {
      return NextResponse.json({error:'Confirme que leu e concorda com os termos.'},{status:400})
    }
    // Primeiro aceite preservado para consultas posteriores e login futuro.
    const result=await db.$transaction(async tx=>{
      const previous=await tx.portalClientPreferences.findUnique({where:{clienteId},
        select:{termsAcceptedAt:true}})
      if(previous?.termsAcceptedAt)return previous.termsAcceptedAt
      const row=await tx.portalClientPreferences.upsert({where:{clienteId},
        create:{clienteId,termsAcceptedAt:new Date()},
        update:{termsAcceptedAt:new Date()},
        select:{termsAcceptedAt:true},
      })
      return row.termsAcceptedAt
    })
    return NextResponse.json({acceptedAt:result})
  }catch(error){return experienceError(error)}
}
