import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { prepararPrimeiraHomologacao, SKU_TESTE_INICIAL } from '@/lib/nfe-homologacao-preparo'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(){
  const user=await getUsuarioLogado()
  if(!user)return NextResponse.json({error:'Não autenticado.'},{status:401})
  if(user.role!=='ADMIN')return NextResponse.json({error:'Acesso restrito ao administrador.'},{status:403})
  try{
    const [produto,emitente,historico,regrasAprovadas]=await Promise.all([
      db.produto.findFirst({
        where:{sku:SKU_TESTE_INICIAL,ativo:true},
        select:{
          id:true,nome:true,sku:true,ativo:true,preco:true,ncm:true,gtinFiscal:true,
          cfop:true,csosn:true,pisCst:true,cofinsCst:true,cest:true,origem:true,unidadeFiscal:true,
        },
      }),
      db.configuracaoFiscal.findUnique({where:{id:'matilha-prado'},
        select:{
          cnpj:true,inscricaoEstadual:true,regimeTributario:true,serieNfe:true,
          ambiente:true,uf:true,razaoSocial:true,
        }}),
      db.notaFiscal.findMany({where:{modelo:'55',numero:{not:null}},
        select:{serie:true,numero:true,emissor:true,status:true},
        take:500,orderBy:{numero:'desc'}}),
      db.regraFiscalAprovada.count({where:{ativo:true}}),
    ])
    const data=prepararPrimeiraHomologacao({
      produto,emitente,documentos:historico,regrasAprovadas,
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
