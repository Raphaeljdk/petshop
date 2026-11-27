// Leitura administrativa: nunca reserva número, aprova regra, transmite ou escreve no banco.
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
const maiorExterno=z.coerce.number().int().min(0).max(999999999).parse(process.argv[2])
const db=new PrismaClient()
async function verificar(){
 const e=await db.configuracaoFiscal.findUniqueOrThrow({where:{id:'matilha-prado'}})
 const cnpj=e.cnpj?.replace(/\D/g,'')??''
 if(!/^\d{14}$/.test(cnpj)||e.serieNfe!==2||e.uf!=='SP')throw Error('Emitente ou série incompatível.')
 const [seq,local]=await Promise.all([
  db.nfeRealSequencia.findUnique({where:{cnpj_modelo_serie_ambiente:{cnpj,modelo:'55',serie:2,ambiente:1}}}),
  db.$queryRaw<{ultimo:number}[]>`SELECT COALESCE(MAX(n),0)::int AS ultimo FROM (
   SELECT numero AS n FROM "NotaFiscal" WHERE modelo='55' AND serie=2
   UNION ALL SELECT substring("chaveAcesso",26,9)::int FROM "NotaFiscal" WHERE "chaveAcesso" ~ '^[0-9]{44}$' AND substring("chaveAcesso",7,19)=${cnpj+'55002'}
   UNION ALL SELECT numero FROM "NfeRealReserva" WHERE cnpj=${cnpj} AND serie=2 AND ambiente=1
  ) a`
 ])
 const candidato=Math.max(maiorExterno+1,local[0].ultimo+1,seq?.proximoNumero??1)
 console.log(JSON.stringify({serie:2,maiorExterno,maiorLocal:local[0].ultimo,proximoRegistrado:seq?.proximoNumero??null,candidato,esgotada:candidato>999999999,habilitado:seq?.habilitado??false,aviso:'Simulação de leitura. Confira outras emissões, inutilizações e pendências antes da conciliação definitiva.'},null,2))
}
verificar().catch(()=>{console.error('Não foi possível ler a numeração fiscal.');process.exitCode=1}).finally(()=>db.$disconnect())
