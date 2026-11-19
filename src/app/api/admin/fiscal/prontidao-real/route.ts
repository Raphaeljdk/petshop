import {NextResponse} from 'next/server'
import {db} from '@/lib/db'
import {getUsuarioLogado} from '@/lib/auth-cookies'
import {comporPainelLiberacao} from '@/lib/nfe-painel-liberacao'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(){
 const user=await getUsuarioLogado()
 if(!user)return NextResponse.json({error:'Não autenticado.'},{status:401})
 if(user.role!=='ADMIN')return NextResponse.json({error:'Acesso restrito.'},{status:403})
 try{
  const [notas,testes,regras]=await Promise.all([
   db.notaFiscal.findMany({where:{modelo:'55',numero:{not:null}},select:{
    modelo:true,serie:true,numero:true,status:true,emissor:true,
   },orderBy:{numero:'desc'},take:2000}),
   db.nfeHomologacao.findMany({where:{ambiente:2},select:{
    serie:true,numero:true,status:true,codigoSefaz:true,protocolo:true,xmlAutorizado:true,
   },take:100,orderBy:{numero:'desc'}}),
   db.regraFiscalAprovada.count({where:{ativo:true}}),
  ])
  return NextResponse.json(comporPainelLiberacao({
   notas,testes:testes.map(n=>({...n,temXml:!!n.xmlAutorizado})),
   emissaoRealImplementada:false,
   emailAutomatico:process.env.NFE_EMAIL_AUTOMATICO_ENABLED==='true',regrasAtivas:regras,
  }),{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
 }catch(err){
  console.error('[nfe/prontidao-real] leitura indisponível',err instanceof Error?err.name:'erro')
  return NextResponse.json({error:'Não foi possível consultar a prontidão fiscal.'},{status:503})
 }
}
