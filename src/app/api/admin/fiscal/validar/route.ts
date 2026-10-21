import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import { avaliarEmissaoFiscal } from '@/lib/fiscal-central'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(req:NextRequest){
  const user=await getUsuarioLogado()
  if(!user)return NextResponse.json({error:'Não autenticado.'},{status:401})
  if(user.role!=='ADMIN')return NextResponse.json({error:'Acesso restrito ao administrador.'},{status:403})
  try{
    assertSameOrigin(req)
    const input=z.object({vendaId:z.string().min(1).max(100)}).strict().safeParse(await req.json())
    if(!input.success)return NextResponse.json({error:'Identificação da venda inválida.'},{status:400})
    const [venda,empresa]=await Promise.all([
      db.venda.findUnique({where:{id:input.data.vendaId},select:{
        canal:true,status:true,total:true,marketplaceOrderId:true,marketplaceBuyerDocument:true,
        enderecoEntrega:true,cepEntrega:true,
        cliente:{select:{cpfCnpj:true,endereco:true,cep:true}},
        notaFiscal:{select:{status:true,chaveAcesso:true,emissorDocumentoId:true}},
        itens:{select:{quantidade:true,precoUnit:true,produto:{
          select:{nome:true,ncm:true,origem:true,unidadeFiscal:true,cst:true,csosn:true}
        }}}
      }}),
      db.configuracaoFiscal.findUnique({where:{id:'matilha-prado'}}),
    ])
    if(!venda)return NextResponse.json({error:'Pedido não encontrado.'},{status:404})
    return NextResponse.json(avaliarEmissaoFiscal({venda,empresa,
      meliHabilitado:process.env.MERCADO_LIVRE_NFE_EMISSAO_HABILITADA==='true',
      emissorUniversalConfigurado:!!(process.env.FOCUS_NFE_TOKEN_PRODUCAO || process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO),
      emissorUniversalHomologado:false,
    }),{headers:{'Cache-Control':'no-store'}})
  }catch(error){
    console.error('Fiscal preflight:',error)
    return NextResponse.json({error:'Não foi possível validar este pedido.'},{status:500})
  }
}
