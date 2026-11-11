import {NextRequest,NextResponse} from 'next/server'
import {db} from '@/lib/db'
import {getUsuarioLogado} from '@/lib/auth-cookies'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}
export async function GET(req:NextRequest){
 const user=await getUsuarioLogado()
 if(!user)return NextResponse.json({error:'Não autenticado.'},{status:401,headers})
 if(user.role!=='ADMIN')return NextResponse.json({error:'Acesso restrito.'},{status:403,headers})
 const id=req.nextUrl.searchParams.get('id')||''
 if(id.length<1||id.length>120)return NextResponse.json({error:'Documento inválido.'},{status:400,headers})
 const nota=await db.nfeHomologacao.findUnique({where:{id},
  select:{ambiente:true,status:true,serie:true,numero:true,xmlAutorizado:true}})
 if(!nota||nota.ambiente!==2||nota.status!=='autorizada'||!nota.xmlAutorizado)
  return NextResponse.json({error:'XML autorizado em homologação ainda indisponível.'},{status:409,headers})
 return new NextResponse(nota.xmlAutorizado,{headers:{
  ...headers,
  'Content-Type':'application/xml; charset=utf-8',
  'Content-Disposition':'attachment; filename="NFE-HOMOLOGACAO-S'+nota.serie+'-N'+nota.numero+'.xml"',
 }})
}
