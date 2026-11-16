import { NextRequest,NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { db } from '@/lib/db'
import { isServiceProduct } from '@/lib/product-stock'

export const runtime='nodejs'
export const dynamic='force-dynamic'

async function requireAdmin() {
  const user=await getUsuarioLogado()
  return user?.role==='ADMIN'?user:null
}

// Consulta apenas divergências conhecidas, sem supor que quantidade anunciada
// equivale a saldo físico disponível para venda.
export async function GET() {
  if(!await requireAdmin())
    return NextResponse.json({error:'Acesso negado.'},{status:403})
  const where={
    mlItemId:{not:null},
    estoque:{lte:0},
    estoqueMercadoLivre:{gt:0},
  } as const
  const [total,rows]=await Promise.all([
    db.produto.count({where}),
    db.produto.findMany({where,orderBy:{estoqueMercadoLivre:'desc'},take:100,
      select:{id:true,nome:true,sku:true,mlItemId:true,estoque:true,estoqueMercadoLivre:true,
        estoqueAmazon:true,ativo:true,categoria:true,estoqueIlimitado:true},
    }),
  ])
  return NextResponse.json({total,items:rows.filter(p=>!isServiceProduct(p))},{
    headers:{'Cache-Control':'private,no-store'}})
}

export async function POST(req:NextRequest) {
  const user=await requireAdmin()
  if(!user)return NextResponse.json({error:'Acesso negado.'},{status:403})
  const origin=req.headers.get('origin')
  if(origin&&origin!==new URL(req.url).origin)
    return NextResponse.json({error:'Origem não autorizada.'},{status:403})
  const data=await req.json().catch(()=>null) as {
    productId?:unknown; mlItemId?:unknown;quantity?:unknown;expectedStock?:unknown
  }|null
  const quantity=data?.quantity, expectedStock=data?.expectedStock
  if(typeof data?.productId!=='string'||typeof data.mlItemId!=='string'||
    !Number.isInteger(quantity)||Number(quantity)<0||Number(quantity)>100000||
    !Number.isInteger(expectedStock)||Number(expectedStock)<0)
    return NextResponse.json({error:'Preencha o estoque físico com um número inteiro válido.'},{status:400})
  const verifiedQty=Number(quantity)
  const expectedQty=Number(expectedStock)
  const product=await db.produto.findUnique({where:{id:data.productId},
    select:{id:true,nome:true,categoria:true,estoqueIlimitado:true,mlItemId:true,
      estoque:true,estoqueMercadoLivre:true}})
  if(!product||product.mlItemId!==data.mlItemId||isServiceProduct(product))
    return NextResponse.json({error:'Produto físico não encontrado ou vínculo alterado.'},{status:404})
  if(product.estoque!==expectedQty)
    return NextResponse.json({error:'O estoque mudou desde a consulta. Atualize a página e confira novamente.'},{status:409})
  try{
    const result=await db.$transaction(async tx=>{
      const updated=await tx.produto.updateMany({
        where:{id:product.id,estoque:expectedQty,mlItemId:data.mlItemId},
        data:{estoque:verifiedQty,estoqueHub:verifiedQty,ativo:verifiedQty>0},
      })
      if(!updated.count) return null
      await tx.marketplaceStockConfirmation.create({data:{
        productId:product.id,mlItemId:product.mlItemId!,adminId:user.id,
        previousStock:product.estoque,confirmedStock:verifiedQty,
        marketplaceStockSeen:product.estoqueMercadoLivre,
      }})
      return {productId:product.id,stock:verifiedQty,published:verifiedQty>0}
    })
    if(!result)return NextResponse.json({error:'O estoque foi alterado por outra operação. Atualize a lista.'},{status:409})
    return NextResponse.json({success:true,...result},
      {headers:{'Cache-Control':'private,no-store'}})
  }catch(error){
    console.error('[estoque-confirmacao] falha',error)
    return NextResponse.json({error:'Falha ao salvar conferência do estoque físico.'},{status:503})
  }
}
