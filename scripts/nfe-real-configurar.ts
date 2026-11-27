// Executar com Bun em um terminal administrativo. O arquivo de evidência fica fora do repositório.
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { cfopRevendaPorDestino } from '../src/lib/nfe-destino'
import { PACOTE_NFE } from '../src/lib/nfe-validacao-xsd'

const ref=z.string().trim().min(5).max(500)
const entrada=z.discriminatedUnion('acao',[
 z.object({acao:z.literal('aprovar-sku'),regraId:z.string().min(1),sku:z.string().min(1),
  referenciaContabil:ref,aprovadoParaProducao:z.literal(true),baseZeroCst49:z.boolean()}).strict(),
 z.object({acao:z.literal('conciliar-serie'),maiorNumeroExterno:z.number().int().min(0).max(999999999),
  referenciaNumeracao:ref,referenciaContabil:ref,confirmadaExclusividade:z.literal(true)}).strict(),
])
async function configurar(){
 const path=process.argv[2]
 if(!path)throw Error('Informe o arquivo JSON com a aprovação do SKU ou a conciliação da série.')
 const input=entrada.parse(JSON.parse(readFileSync(path,'utf8')))
 const db=new PrismaClient()
 try{
  await db.$transaction(async tx=>{
   const e=await tx.configuracaoFiscal.findUniqueOrThrow({where:{id:'matilha-prado'}})
   const cnpj=e.cnpj?.replace(/\D/g,'')||''
   if(!/^\d{14}$/.test(cnpj)||e.uf!=='SP'||e.serieNfe!==2||e.ambiente!=='producao'||e.regimeTributario!=='1'||e.apuracaoTributaria!=='PGDAS_D')throw Error('Confira o cadastro fiscal.')
   if(input.acao==='aprovar-sku'){
    const r=await tx.regraFiscalAprovada.findUniqueOrThrow({where:{id:input.regraId}})
    if(!r.ativo||input.referenciaContabil===r.referencia&&/homologa/i.test(r.observacoes||''))throw Error('Exige referência de aprovação da contabilidade para produção.')
    const produtos=await tx.produto.findMany({where:{sku:input.sku,ncm:r.ncm,origem:r.origem,csosn:r.csosn,cest:r.cest,pisCst:r.pisCst,cofinsCst:r.cofinsCst},select:{cfop:true}})
    if(!produtos.some(p=>{try{return cfopRevendaPorDestino(p.cfop??'',r.ufDestino)===r.cfop}catch{return false}}))throw Error('O SKU e a regra informados não correspondem.')
    if([r.pisCst,r.cofinsCst].includes('49')&&!input.baseZeroCst49)throw Error('O tratamento implementado de CST 49 exige confirmação da base zero.')
    const aprovacao={referencia:input.referenciaContabil,revisaoRegra:r.atualizadoEm,baseZeroCst49:input.baseZeroCst49}
    await tx.nfeRealAprovacao.upsert({where:{regraId_sku:{regraId:r.id,sku:input.sku}},create:{regraId:r.id,sku:input.sku,...aprovacao},update:aprovacao})
    return
   }
   // Serializa contra emissão e contra uma importação de chave de outro sistema.
   await tx.$executeRaw`LOCK TABLE "NfeRealSequencia" IN SHARE ROW EXCLUSIVE MODE`
   await tx.$executeRaw`LOCK TABLE "NotaFiscal" IN SHARE MODE`
   const where={cnpj_modelo_serie_ambiente:{cnpj,modelo:'55',serie:2,ambiente:1}}
   const seq=await tx.nfeRealSequencia.findUnique({where})
   const local=await tx.$queryRaw<{ultimo:number}[]>`SELECT COALESCE(MAX(n),0)::int AS ultimo FROM (
    SELECT numero AS n FROM "NotaFiscal" WHERE modelo='55' AND serie=2
    UNION ALL SELECT substring("chaveAcesso",26,9)::int FROM "NotaFiscal" WHERE "chaveAcesso" ~ '^[0-9]{44}$' AND substring("chaveAcesso",7,19)=${cnpj+'55002'}
    UNION ALL SELECT numero FROM "NfeRealReserva" WHERE cnpj=${cnpj} AND serie=2 AND ambiente=1
   ) a`
   const proximoNumero=Math.max(input.maiorNumeroExterno+1,local[0].ultimo+1,seq?.proximoNumero??1)
   if(proximoNumero>999999999)throw Error('Série esgotada.')
   const dados={proximoNumero,referenciaNumeracao:input.referenciaNumeracao,referenciaContabil:input.referenciaContabil,
    referenciaSchema:PACOTE_NFE,exclusivo:true,habilitado:true,updatedAt:new Date()}
   await tx.nfeRealSequencia.upsert({where,create:{...where.cnpj_modelo_serie_ambiente,primeiroNumero:1,...dados},update:dados})
   console.info('Próximo número conciliado da série 2:',proximoNumero)
  },{isolationLevel:'Serializable'})
  console.info('Configuração fiscal registrada.')
 }finally{await db.$disconnect()}
}
configurar().catch(e=>{console.error(e instanceof z.ZodError?'Arquivo de evidência inválido.':e instanceof Error&&!('code' in e)?e.message:'Não foi possível registrar a configuração fiscal.');process.exitCode=1})
