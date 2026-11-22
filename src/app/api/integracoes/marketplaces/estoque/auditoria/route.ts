import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { buildSkuAudit } from '@/lib/sku-reconciliation-audit'

export const dynamic='force-dynamic'
export const runtime='nodejs'

function csvCell(value: unknown) {
  const text=String(value??'')
  // CSV pode ser aberto em planilhas: neutralizar injeção de fórmula.
  const sanitized=/^[=+@\-\t\r]/.test(text)?"'"+text:text
  return '"'+sanitized.replaceAll('"','""')+'"'
}
export async function GET(request:NextRequest) {
  const user=await getUsuarioLogado()
  if(!user)return NextResponse.json({error:'Não autenticado.'},{status:401})
  if(user.role!=='ADMIN')return NextResponse.json({error:'Acesso negado.'},{status:403})
  try {
    const [products,pendingMl,pendingAmazon,issues]=await Promise.all([
      db.produto.findMany({select:{id:true,sku:true,nome:true,estoque:true,
        estoqueHub:true,ativo:true,mlItemId:true,amazonAsin:true},
        orderBy:{sku:'asc'}}),
      db.venda.count({where:{canal:'mercadolivre',status:'concluida',
        marketplaceStockAppliedAt:null}}),
      db.venda.count({where:{canal:'amazon',status:'concluida',
        marketplaceStockAppliedAt:null}}),
      db.marketplaceStockIssue.count({where:{resolvedAt:null}}),
    ])
    const audit=buildSkuAudit(products)
    const pending={mercadoLivre:pendingMl,amazon:pendingAmazon,marketplaceIssues:issues}
    if(request.nextUrl.searchParams.get('format')==='csv'){
      const headers=['SKU','ID do produto','Nome','Estoque operacional','Estoque Hub',
        'Ativo','Anúncio ML','ASIN Amazon','Categoria da pendência',
        'Quantidade de registros com mesmo SKU']
      const rows=audit.groups.flatMap(group=>group.items.map(p=>[
        group.sku,p.id,p.nome,p.estoque,p.estoqueHub,p.ativo?'SIM':'NÃO',
        p.mlItemId||'',p.amazonAsin||'',group.status,group.items.length,
      ]))
      const csv='\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n')
      return new Response(csv,{headers:{
        'Content-Type':'text/csv; charset=utf-8',
        'Content-Disposition':'attachment; filename="matilha-prado-conciliacao-skus.csv"',
        'Cache-Control':'private, no-store',
      }})
    }
    return NextResponse.json({...audit,pending,readOnly:true,generatedAt:new Date().toISOString()},{
      headers:{'Cache-Control':'private, no-store'},
    })
  }catch(error){
    console.error('[estoque/auditoria] falha:',error)
    return NextResponse.json({error:'Não foi possível gerar a auditoria de estoque.'},{status:500})
  }
}
