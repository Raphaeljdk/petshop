import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { portalCliente } from '@/lib/portal-care'
import { experienceBody,experienceError } from '@/lib/customer-experience'
import { db } from '@/lib/db'
import { giftCode,quoteGiftCredit,GiftCreditError } from '@/lib/portal-gift-credit'
export const dynamic='force-dynamic'
const schema=z.object({code:z.string().trim().min(6).max(80),totalCents:z.number().int().min(1).max(100000000)}).strict()
export async function POST(req:NextRequest){
  try {
    const {user,clienteId}=await portalCliente()
    const data=schema.parse(await experienceBody(req))
    const value=await quoteGiftCredit(db,giftCode(data.code),clienteId,user.email,data.totalCents)
    return NextResponse.json({code:giftCode(data.code),availableCents:value.availableCents,
      appliedCents:value.appliedCents},{headers:{'Cache-Control':'private, no-store'}})
  }catch(error){
    if(error instanceof GiftCreditError)return NextResponse.json({error:error.message},{status:error.status})
    return experienceError(error)
  }
}
