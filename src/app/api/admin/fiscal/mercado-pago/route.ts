import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import { interpretarChaveNfe } from '@/lib/fiscal-chave'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const bodySchema = z.object({
  vendaId:z.string().min(1).max(100),
  chaveAcesso:z.string().min(44).max(55),
  confirmacao:z.literal('JA_EMITIDA_FORA_DO_ERP'),
}).strict()

async function admin(){
  const user=await getUsuarioLogado()
  if(!user)return NextResponse.json({error:'Não autenticado.'},{status:401})
  if(user.role!=='ADMIN')return NextResponse.json({error:'Acesso restrito ao administrador.'},{status:403})
  return null
}
export async function GET(req:NextRequest){
  const denied=await admin();if(denied)return denied
  const id=req.nextUrl.searchParams.get('vendaId')||''
  if(!id||id.length>100)return NextResponse.json({error:'Venda inválida.'},{status:400})
  try {
    const [venda,emitente] = await Promise.all([
      db.venda.findUnique({where:{id},select:{
        id:true,canal:true,status:true,total:true,valorFrete:true,marketplaceOrderId:true,
        marketplaceBuyerName:true,marketplaceBuyerDocument:true,
        cliente:{select:{nome:true,cpfCnpj:true,email:true,cep:true,endereco:true}},
        cepEntrega:true,enderecoEntrega:true,
        itens:{select:{quantidade:true,precoUnit:true,produto:{
          select:{nome:true,sku:true,ncm:true,cfop:true,cest:true,origem:true,csosn:true,cst:true,unidadeFiscal:true},
        }}},
        notaFiscal:{select:{status:true,chaveAcesso:true,emissor:true}},
      }}),
      db.configuracaoFiscal.findUnique({where:{id:'matilha-prado'},select:{nomeFantasia:true,cnpj:true}}),
    ])
    if(!venda)return NextResponse.json({error:'Venda não encontrada.'},{status:404})
    const linhas=[
      'RESUMO PARA CONFERÊNCIA NO EMISSOR MERCADO PAGO (NÃO É NOTA FISCAL)',
      'Pedido ERP: '+venda.id,
      'Canal: '+venda.canal,
      'Pedido marketplace: '+(venda.marketplaceOrderId||'—'),
      'Status: '+venda.status,
      'Emitente: '+(emitente?.nomeFantasia||'—'),
      'CNPJ emitente: '+(emitente?.cnpj||'—'),
      'Destinatário: '+(venda.cliente?.nome||venda.marketplaceBuyerName||'Não identificado'),
      'CPF/CNPJ destinatário: '+(venda.cliente?.cpfCnpj||venda.marketplaceBuyerDocument||'Não informado'),
      'E-mail: '+(venda.cliente?.email||'—'),
      'CEP: '+(venda.cepEntrega||venda.cliente?.cep||'—'),
      'Endereço: '+(venda.enderecoEntrega||venda.cliente?.endereco||'—'),
      'Itens para revisão fiscal:',
      ...venda.itens.map((item,i)=>[
        (i+1)+'. '+item.produto.nome,
        'SKU '+(item.produto.sku||'—'),
        'Qtde '+item.quantidade,
        'Unit. R$ '+item.precoUnit.toFixed(2),
        'NCM '+(item.produto.ncm||'PENDENTE'),
        'CFOP '+(item.produto.cfop||'REVISAR POR OPERAÇÃO'),
        'Origem '+(item.produto.origem||'PENDENTE'),
        'CST '+(item.produto.cst||'—')+' / CSOSN '+(item.produto.csosn||'—'),
      ].join(' | ')),
      'Frete informado: R$ '+(venda.valorFrete||0).toFixed(2),
      'Total do pedido: R$ '+venda.total.toFixed(2),
      'Documento fiscal no ERP: '+(venda.notaFiscal?.status||'sem registro'),
      'ATENÇÃO: conferir impostos, descontos, frete e documentos fiscais prévios antes de emitir.',
      'Não registre outra venda ou pagamento se o pedido já foi pago no marketplace/site.',
    ]
    return NextResponse.json({resumo:linhas.join('\n'),canal:venda.canal,status:venda.status,
      possuiNota:!!venda.notaFiscal?.chaveAcesso,aviso:'Este resumo não cria venda, cobrança nem NF-e. Confira as informações no Mercado Pago.'},
      {headers:{'Cache-Control':'private, no-store'}})
  }catch(err){
    console.error('resumo fiscal Mercado Pago:',err)
    return NextResponse.json({error:'Não foi possível preparar o resumo fiscal.'},{status:500})
  }
}

export async function POST(req:NextRequest){
  const denied=await admin();if(denied)return denied
  try {
    assertSameOrigin(req)
    const parsed=bodySchema.safeParse(await req.json())
    if(!parsed.success)return NextResponse.json({error:'Informe o pedido, a chave de 44 dígitos e confirme que a nota já foi emitida.'},{status:400})
    const {vendaId,chaveAcesso}=parsed.data
    const [venda,config]=await Promise.all([
      db.venda.findUnique({where:{id:vendaId},select:{
        id:true,status:true,canal:true,notaFiscal:{select:{id:true,status:true,chaveAcesso:true,emissorDocumentoId:true}},
      }}),
      db.configuracaoFiscal.findUnique({where:{id:'matilha-prado'},select:{cnpj:true}}),
    ])
    if(!venda)return NextResponse.json({error:'Venda não encontrada.'},{status:404})
    if(venda.status==='cancelada')return NextResponse.json({error:'Venda cancelada não pode receber nova nota.'},{status:409})
    let fiscal
    try{fiscal=interpretarChaveNfe(chaveAcesso,config?.cnpj||'')}
    catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Chave fiscal inválida.'},{status:400})}
    if(['site','amazon','mercadolivre','mercado_livre'].includes(venda.canal)&&fiscal.modelo!=='55')
      return NextResponse.json({error:'Este pedido online requer NF-e modelo 55. Confira a chave e o documento emitido.'},{status:409})
    if(venda.notaFiscal && (venda.notaFiscal.status!=='rascunho' ||
      venda.notaFiscal.chaveAcesso || venda.notaFiscal.emissorDocumentoId))
      return NextResponse.json({error:'Este pedido já possui conciliação ou emissão fiscal. Consulte o histórico antes de registrar outra chave.'},{status:409})

    // Chave de acesso validada matematicamente e por CNPJ, mas ainda NÃO consultada na SEFAZ.
    // Não atribuir status autorizada nem gerar XML/DANFE.
    const nota=await db.$transaction(async(tx)=>{
      const existing=await tx.notaFiscal.findUnique({where:{vendaId}})
      if(existing){
        const updated=await tx.notaFiscal.updateMany({
          where:{vendaId,status:'rascunho',chaveAcesso:null,emissorDocumentoId:null},
          data:{modelo:fiscal.modelo,status:'informada_pendente_verificacao',emissor:'mercado_pago_manual',
            chaveAcesso:fiscal.chaveAcesso,numero:fiscal.numero,serie:fiscal.serie,
            erro:'Chave informada pelo operador; a autorização SEFAZ ainda não foi verificada.',
            consultadaEm:new Date()},
        })
        if(updated.count!==1)throw new Error('Conciliação fiscal concorrente.')
      }else{
        await tx.notaFiscal.create({data:{
          vendaId,modelo:fiscal.modelo,status:'informada_pendente_verificacao',emissor:'mercado_pago_manual',
          chaveAcesso:fiscal.chaveAcesso,numero:fiscal.numero,serie:fiscal.serie,
          erro:'Chave informada pelo operador; a autorização SEFAZ ainda não foi verificada.',
          consultadaEm:new Date(),
        }})
      }
      return tx.notaFiscal.findUniqueOrThrow({where:{vendaId},select:{id:true,status:true,numero:true,serie:true,chaveAcesso:true}})
    })
    return NextResponse.json({nota,autorizada:false,
      aviso:'Chave registrada para conciliação, mas NÃO validada na SEFAZ. Confira autorização e XML no emissor Mercado Pago.'},
      {headers:{'Cache-Control':'no-store'}})
  }catch(e){
    if(e instanceof Prisma.PrismaClientKnownRequestError && e.code==='P2002')
      return NextResponse.json({error:'A chave fiscal já existe em outro pedido. Registro duplicado bloqueado.'},{status:409})
    if(e instanceof Error && e.message==='Conciliação fiscal concorrente.')
      return NextResponse.json({error:e.message},{status:409})
    console.error('conciliação nota Mercado Pago:',e)
    return NextResponse.json({error:'Não foi possível conciliar esta NF-e. Nenhuma nota nova foi emitida.'},{status:500})
  }
}
