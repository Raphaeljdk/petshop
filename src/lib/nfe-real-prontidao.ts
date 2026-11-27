import { Prisma } from '@prisma/client'
import { db } from './db'
import { PACOTE_NFE } from './nfe-validacao-xsd'
import { emissaoAtivaNoServidor } from './nfe-real-servico'
import { type ConfigFiscalReadiness } from './fiscal-prontidao-producao'

export async function situacaoEmissao(empresa:ConfigFiscalReadiness){
 const cnpj=empresa?.cnpj?.replace(/\D/g,'')||''
 const homologacao=!!cnpj&&!!await db.nfeHomologacao.findFirst({where:{
  ambiente:2,serie:2,status:'autorizada',codigoSefaz:{in:[100,150]},protocolo:{not:null},
  xmlAutorizado:{not:null},chave:{contains:cnpj+'55002'},
 },select:{id:true}})
 let serie=false,regras=false,estrutura=true
 try{
  const [seq,contagem]=await Promise.all([
   db.nfeRealSequencia.findUnique({where:{cnpj_modelo_serie_ambiente:{cnpj,modelo:'55',serie:2,ambiente:1}}}),
   db.$queryRaw<{total:number}[]>`SELECT count(*)::int AS total FROM "NfeRealAprovacao" a
    JOIN "RegraFiscalAprovada" r ON r.id=a."regraId" AND r."atualizadoEm"=a."revisaoRegra"
    WHERE r.ativo AND (r."vigenteDesde" IS NULL OR r."vigenteDesde"<=CURRENT_TIMESTAMP)
    AND (r."vigenteAte" IS NULL OR r."vigenteAte">=CURRENT_TIMESTAMP)
    AND ((r."pisCst"<>'49' AND r."cofinsCst"<>'49') OR a."baseZeroCst49")`,
  ])
  serie=!!seq?.habilitado&&seq.exclusivo&&seq.referenciaSchema===PACOTE_NFE
  regras=contagem[0].total>0
 }catch(e){
  if(!(e instanceof Prisma.PrismaClientKnownRequestError)||
   !(e.code==='P2021'||e.code==='P2022'||(e.code==='P2010'&&['42P01','42703'].includes(String(e.meta?.code)))))throw e
  estrutura=false
 }
 const habilitada=serie&&regras&&homologacao&&emissaoAtivaNoServidor()&&empresa?.ambiente==='producao'
  &&empresa?.uf==='SP'&&empresa.serieNfe===2&&empresa.regimeTributario==='1'&&empresa.apuracaoTributaria==='PGDAS_D'
  &&!!process.env.SEFAZ_NFE_A1_PFX_BASE64?.trim()&&!!process.env.SEFAZ_NFE_A1_SENHA
 return {estrutura,serie,regras,homologacao,habilitada}
}
