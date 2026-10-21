import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Nuvem Fiscal encerrou em 31/07/2026. Substituída por diagnóstico somente leitura
// do provedor Focus NFe; nenhum endpoint de emissão é chamado nesta rota.
function credentials(){
  return {
    producao: Boolean(process.env.FOCUS_NFE_TOKEN_PRODUCAO?.trim()),
    homologacao: Boolean(process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO?.trim()),
  }
}
async function authorize(){
  const u = await getUsuarioLogado()
  if(!u)return NextResponse.json({error:'Não autenticado.'},{status:401})
  if(u.role!=='ADMIN')return NextResponse.json({error:'Acesso restrito.'},{status:403})
  return null
}
export async function GET(){
  const denied=await authorize(); if(denied)return denied
  return NextResponse.json({
    provedor:'Focus NFe',
    credenciais:credentials(),
    emissaoRealHabilitada:false,
    aviso:'Focus NFe: API para NF-e, NFC-e e NFS-e. Teste de integração em modo leitura, sem emissão. É necessário credenciar CNPJ, certificado, tributação e homologação.',
  },{headers:{'Cache-Control':'no-store'}})
}
export async function POST(req:NextRequest){
  const denied=await authorize(); if(denied)return denied
  try{
    assertSameOrigin(req)
    const token=process.env.FOCUS_NFE_TOKEN_PRODUCAO?.trim()
    if(!token)return NextResponse.json({ok:false,
      error:'Cadastre FOCUS_NFE_TOKEN_PRODUCAO na Vercel para testar a consulta somente leitura das empresas. Não é possível testar usando as credenciais do Mercado Pago ou da Amazon.'},{status:409})
    const emitente=await db.configuracaoFiscal.findUnique({
      where:{id:'matilha-prado'},select:{cnpj:true}
    })
    const cnpj=emitente?.cnpj?.replace(/\D/g,'')||''
    if(!/^\d{14}$/.test(cnpj))return NextResponse.json({
      error:'Cadastre um CNPJ válido em Dados do emitente antes de testar o provedor.'},{status:409})
    // GET sem efeito fiscal, com URL e escopo de rede fixos, sem revelar token nem dados externos.
    const url=new URL('https://api.focusnfe.com.br/v2/empresas')
    url.searchParams.set('cnpj',cnpj)
    const response=await fetch(url,{
      headers:{'Authorization':'Basic '+Buffer.from(token+':').toString('base64'),
        'Accept':'application/json'},
      cache:'no-store',signal:AbortSignal.timeout(15000),
    })
    if(response.status===401||response.status===403)return NextResponse.json({
      ok:false,error:'Focus NFe recusou o token para consultar empresas. Confira a credencial da conta (HTTP '+response.status+').'},{status:409})
    if(!response.ok)return NextResponse.json({
      ok:false,error:'Consulta de empresas Focus NFe indisponível (HTTP '+response.status+'). Nenhuma nota foi emitida.'},{status:502})
    const entries=await response.json() as Array<{
      cnpj?:string; habilita_nfe?:boolean; habilita_nfce?:boolean; habilita_nfse?:boolean;
    }>
    if(!Array.isArray(entries))return NextResponse.json({
      error:'Retorno inesperado do provedor fiscal.'},{status:502})
    const match=entries.find(e=>e.cnpj?.replace(/\D/g,'')===cnpj)
    return NextResponse.json({
      ok:Boolean(match),emitenteEncontrado:Boolean(match),
      nfeHabilitada:Boolean(match?.habilita_nfe),
      nfceHabilitada:Boolean(match?.habilita_nfce),
      nfseHabilitada:Boolean(match?.habilita_nfse),
      emissaoRealHabilitada:false,
      aviso:match
        ? 'CNPJ localizado no Focus NFe. Consulta autenticada; nenhuma nota foi emitida. Ainda faltam testes de homologação e habilitação da emissão.'
        : 'Token aceito, mas o CNPJ da Matilha Prado ainda não foi encontrado entre as empresas do provedor.',
    },{headers:{'Cache-Control':'no-store'}})
  }catch(e){
    console.error('Focus NFe read-only check:',e)
    return NextResponse.json({error:'Falha ao validar a conexão somente leitura do emissor.'},{status:503})
  }
}
