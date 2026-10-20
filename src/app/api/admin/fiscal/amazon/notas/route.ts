import { NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { amazonAccessToken, amazonSpApiConfig, AmazonSpApiError } from '@/lib/amazon-sp-api'

export const runtime='nodejs'
export const dynamic='force-dynamic'

// A API oficial Invoices v2024-06-19 (Brasil) recupera APENAS documentos FBA.
// Outros pedidos Amazon precisam do emissor fiscal do próprio vendedor.
export async function GET(){
  const user=await getUsuarioLogado()
  if(!user)return NextResponse.json({error:'Não autenticado.'},{status:401})
  if(user.role!=='ADMIN')return NextResponse.json({error:'Acesso restrito.'},{status:403})
  try{
    const config=amazonSpApiConfig()
    const token=await amazonAccessToken()
    const url=new URL('/tax/invoices/2024-06-19/invoices',config.endpoint)
    url.searchParams.set('marketplaceId',config.marketplaceId)
    url.searchParams.set('pageSize','50')
    const response=await fetch(url,{
      headers:{'x-amz-access-token':token,'Accept':'application/json',
        'user-agent':'MatilhaPrado/1.0 (Language=TypeScript; Platform=Vercel)'},
      cache:'no-store',signal:AbortSignal.timeout(15000)
    })
    if(response.status===403)return NextResponse.json({
      error:'A aplicação Amazon não tem a função de Invoices/Faturamento. Habilite o acesso na Seller Central e reautorize o aplicativo.',
    },{status:403})
    if(!response.ok)return NextResponse.json({
      error:'Consulta de notas FBA recusada pela Amazon (HTTP '+response.status+').',
    },{status:502})
    const body=await response.json() as {invoices?:Array<{
      id?:string;externalInvoiceId?:string;status?:string;series?:string;date?:string;
      transactionIds?:Array<{name?:string;id?:string}>;invoiceType?:string;
    }>}
    return NextResponse.json({tipo:'FBA',origem:'amazon',notas:(body.invoices||[]).slice(0,50).map(n=>({
      id:n.id||'',numeroExterno:n.externalInvoiceId||null,serie:n.series||null,
      status:n.status||'desconhecido',data:n.date||null,
      pedido:n.transactionIds?.map(x=>x.id).filter(Boolean).join(', ')||null,
      tipo:n.invoiceType||null,
    })),aviso:'Consulta somente leitura. A API Invoices Amazon não cobre todos os pedidos e não emite notas fiscais.'},
      {headers:{'Cache-Control':'no-store'}})
  }catch(e){
    if(e instanceof AmazonSpApiError)return NextResponse.json({error:e.message},{status:e.status})
    console.error('Amazon FBA notas:',e)
    return NextResponse.json({error:'Não foi possível consultar notas Amazon FBA.'},{status:503})
  }
}
