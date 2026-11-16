import { NextRequest,NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { portalCliente } from '@/lib/portal-care'
import { experienceError } from '@/lib/customer-experience'
import { assertSameOrigin } from '@/lib/auth-http'
export const runtime='nodejs'
export const dynamic='force-dynamic'
type Params={params:Promise<{id:string}>}
export async function GET(_:NextRequest,{params}:Params){
  try{
    const {clienteId}=await portalCliente()
    const {id}=await params
    const doc=await db.portalPetDocument.findFirst({where:{id,clienteId}})
    if(!doc)return NextResponse.json({error:'Documento não encontrado.'},{status:404})
    const file=Buffer.from(doc.fileData,'base64')
    const safe=doc.fileName.replace(/[^A-Za-z0-9_.-]/g,'_').slice(0,110)
    return new NextResponse(new Uint8Array(file),{headers:{
      'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+safe+'"',
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':'sandbox','Content-Length':String(file.length),
    }})
  }catch(error){return experienceError(error)}
}
export async function DELETE(req:NextRequest,{params}:Params){
  try{
    const {clienteId}=await portalCliente()
    assertSameOrigin(req)
    const {id}=await params
    const result=await db.portalPetDocument.deleteMany({where:{id,clienteId}})
    return NextResponse.json({success:result.count>0})
  }catch(error){return experienceError(error)}
}
