import {NextRequest,NextResponse} from 'next/server'
import {db} from '@/lib/db'
import {getUsuarioLogado} from '@/lib/auth-cookies'
import {gerarDanfePdfAutorizado,DanfeError} from '@/lib/nfe-danfe-pdf'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
 const user=await getUsuarioLogado()
 if(!user)return NextResponse.json({error:'Não autenticado.'},{status:401})
 if(user.role!=='ADMIN')return NextResponse.json({error:'Acesso restrito.'},{status:403})
 const id=req.nextUrl.searchParams.get('id')||''
 if(!/^[a-z0-9_-]{5,120}$/i.test(id))
  return NextResponse.json({error:'Identificador fiscal inválido.'},{status:400})
 const nota=await db.notaFiscal.findUnique({where:{id},select:{
  id:true,modelo:true,status:true,emissor:true,chaveAcesso:true,protocolo:true,xmlAutorizado:true,
 }})
 if(!nota||nota.emissor!=='matilha_prado'||nota.status!=='autorizada')
  return NextResponse.json({error:'DANFE não disponível para esta nota.'},{status:404})
 try{
  const pdf=gerarDanfePdfAutorizado(nota)
  return new NextResponse(new Uint8Array(pdf),{headers:{
   'Content-Type':'application/pdf','Content-Length':String(pdf.length),
   'Content-Disposition':'attachment; filename="DANFE-'+nota.chaveAcesso+'.pdf"',
   'Cache-Control':'private, no-store',
   'X-Content-Type-Options':'nosniff',
  }})
 }catch(err){
  console.error('[nfe/danfe] geração bloqueada',err instanceof Error?err.name:'erro')
  return NextResponse.json({error:err instanceof DanfeError?err.message:'Não foi possível gerar o DANFE.'},{status:409})
 }
}
