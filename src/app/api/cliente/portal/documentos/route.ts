import { NextRequest,NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { portalCliente,ownsPet } from '@/lib/portal-care'
import { experienceBody,experienceError } from '@/lib/customer-experience'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const schema=z.object({petKey:z.string().min(1).max(100),
  title:z.string().trim().min(3).max(120),fileName:z.string().trim().min(1).max(120),
  fileData:z.string().min(100).max(1_450_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
}).strict()
export async function POST(req:NextRequest){
  try {
    const {user,clienteId}=await portalCliente()
    const data=schema.parse(await experienceBody(req,1_500_000))
    if(!await ownsPet(user,data.petKey))
      return NextResponse.json({error:'Pet não pertence à sua conta.'},{status:404})
    const bytes=Buffer.from(data.fileData,'base64')
    if(bytes.length>1_048_576 || bytes.length<50 ||
      bytes.subarray(0,5).toString()!=='%PDF-' ||
      !bytes.subarray(-2048).toString('latin1').includes('%%EOF'))
      return NextResponse.json({error:'Envie um PDF válido com até 1 MB.'},{status:400})
    if(await db.portalPetDocument.count({where:{clienteId}})>=15)
      return NextResponse.json({error:'Limite de 15 documentos atingido. Remova um arquivo antigo.'},{status:409})
    const fileName=data.fileName.replace(/[^\w. -]/g,'_').slice(0,100)
    const doc=await db.portalPetDocument.create({data:{
      clienteId,petKey:data.petKey,title:data.title,fileName:fileName.toLowerCase().endsWith('.pdf')?fileName:fileName+'.pdf',
      fileData:data.fileData,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
    },select:{id:true,title:true,createdAt:true}})
    return NextResponse.json(doc,{status:201,headers:{'Cache-Control':'private, no-store'}})
  }catch(error){return experienceError(error)}
}
