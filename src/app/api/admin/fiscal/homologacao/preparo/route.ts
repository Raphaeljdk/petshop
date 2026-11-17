import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { prepararPrimeiraHomologacao, PRODUTO_TESTE_INICIAL_ID } from '@/lib/nfe-homologacao-preparo'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(){
  const user=await getUsuarioLogado()
  if(!user)return NextResponse.json({error:'Não autenticado.'},{status:401})
  if(user.role!=='ADMIN')return NextResponse.json({error:'Acesso restrito ao administrador.'},{status:403})
  try{
    const [produto,emitente,historico,autorizacoesHomologacao]=await Promise.all([
      db.produto.findFirst({
        where:{id:PRODUTO_TESTE_INICIAL_ID,ativo:true},
        select:{
          id:true,nome:true,sku:true,ativo:true,preco:true,ncm:true,gtinFiscal:true,
          cfop:true,csosn:true,pisCst:true,cofinsCst:true,cest:true,origem:true,unidadeFiscal:true,
        },
      }),
      db.configuracaoFiscal.findUnique({where:{id:'matilha-prado'},
        select:{
          cnpj:true,inscricaoEstadual:true,regimeTributario:true,apuracaoTributaria:true,serieNfe:true,
          ambiente:true,uf:true,razaoSocial:true,
        }}),
      db.notaFiscal.findMany({where:{modelo:'55',numero:{not:null}},
        select:{serie:true,numero:true,emissor:true,status:true},
        take:500,orderBy:{numero:'desc'}}),
      db.nfeHomologacao.count({where:{ambiente:2,status:'autorizada',codigoSefaz:{in:[100,150]},protocolo:{not:null},xmlAutorizado:{not:null}}}),
    ])
    // Regra específica da operação interna SP, não basta existir uma regra qualquer no ERP.
    const regrasAprovadas=produto?.ncm&&produto.cfop&&produto.origem&&
      produto.csosn&&produto.pisCst&&produto.cofinsCst
      ?await db.regraFiscalAprovada.count({where:{
        ativo:true,ncm:produto.ncm,cfop:produto.cfop,origem:produto.origem,
        ufDestino:'SP',indicadorIE:'9',csosn:produto.csosn,
        pisCst:produto.pisCst,cofinsCst:produto.cofinsCst,cest:produto.cest,
      }}):0
    const data=prepararPrimeiraHomologacao({
      produto,emitente,documentos:historico,regrasAprovadas,autorizacoesHomologacao,
      certificadoConfigurado:!!(process.env.SEFAZ_NFE_A1_PFX_BASE64?.trim()&&process.env.SEFAZ_NFE_A1_SENHA),
    })
    return NextResponse.json(data,{headers:{
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
    }})
  }catch(err){
    console.error('Falha ao preparar homologação segura da NF-e',err)
    return NextResponse.json({error:'Não foi possível consultar os pré-requisitos da homologação.'},{status:500})
  }
}
