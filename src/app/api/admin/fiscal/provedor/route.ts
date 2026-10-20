import { NextRequest,NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const ready=()=>!!(process.env.NUVEM_FISCAL_CLIENT_ID?.trim()&&process.env.NUVEM_FISCAL_CLIENT_SECRET?.trim())
async function auth(){
  const user=await getUsuarioLogado()
  if(!user)return NextResponse.json({error:'Não autenticado.'},{status:401})
  if(user.role!=='ADMIN')return NextResponse.json({error:'Acesso restrito.'},{status:403})
  return null
}
export async function GET(){
  const denied=await auth();if(denied)return denied
  return NextResponse.json({
    provedor:'Nuvem Fiscal',credenciaisConfiguradas:ready(),emissaoRealHabilitada:false,
    aviso:'A integração universal precisa de credenciais, empresa, certificado, configuração do serviço, payload fiscal aprovado e homologação antes da transmissão.',
  },{headers:{'Cache-Control':'no-store'}})
}
export async function POST(req:NextRequest){
  const denied=await auth();if(denied)return denied
  try{
    assertSameOrigin(req)
    if(!ready())return NextResponse.json({ok:false,error:'Preencha NUVEM_FISCAL_CLIENT_ID e NUVEM_FISCAL_CLIENT_SECRET nas variáveis protegidas de produção.'},{status:409})
    const response=await fetch('https://auth.nuvemfiscal.com.br/oauth/token',{
      method:'POST',cache:'no-store',signal:AbortSignal.timeout(15000),
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'client_credentials',
        client_id:process.env.NUVEM_FISCAL_CLIENT_ID!,client_secret:process.env.NUVEM_FISCAL_CLIENT_SECRET!,
        scope:'empresa nfe nfce'})
    })
    if(!response.ok)return NextResponse.json({ok:false,error:'Credenciais não validadas pela Nuvem Fiscal (HTTP '+response.status+').'},{status:409})
    const data=await response.json() as {access_token?:string;scope?:string}
    if(!data.access_token)return NextResponse.json({ok:false,error:'Autenticação não retornou token válido.'},{status:502})
    return NextResponse.json({ok:true,emissaoRealHabilitada:false,
      aviso:'Credenciais reconhecidas. Nenhuma nota emitida. Ainda é necessário cadastrar CNPJ/certificado e homologar o payload da nota.'},
      {headers:{'Cache-Control':'no-store'}})
  }catch(e){
    console.error('Nuvem Fiscal status:',e)
    return NextResponse.json({error:'Falha ao validar credenciais do emissor.'},{status:503})
  }
}
