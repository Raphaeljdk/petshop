// Diagnóstico somente leitura. Nunca cria, assina, transmite ou cancela uma NF-e.
import { PrismaClient } from '@prisma/client'
import { X509Certificate } from 'node:crypto'
import { extrairCertificadoA1 } from '../src/lib/nfe-assinatura-a1'
import { lerA1DeVariaveis, consultarStatusHomologacaoSefazSp, SefazComunicacaoError } from '../src/lib/sefaz-sp-nfe'
const db=new PrismaClient()
async function verificar(){
 const empresa=await db.configuracaoFiscal.findUniqueOrThrow({where:{id:'matilha-prado'},select:{cnpj:true,uf:true}})
 if(empresa.uf!=='SP'||!empresa.cnpj)throw Error('Emitente indisponível.')
 const cred=lerA1DeVariaveis(process.env)
 const chaves=extrairCertificadoA1(cred.pfx,cred.passphrase,empresa.cnpj)
 const cert=new X509Certificate(chaves.certificadoPem)
 console.log(JSON.stringify({a1:{cnpjConfere:true,chavePrivadaConfere:true,venceEm:chaves.venceEm,fingerprintSha256:cert.fingerprint256}},null,2))
 try{
  const status=await consultarStatusHomologacaoSefazSp(cred)
  console.log(JSON.stringify({homologacao:{disponivel:status.disponivel,codigo:status.codigo}},null,2))
  if(!status.disponivel)process.exitCode=1
 }catch(e){
  console.error(JSON.stringify({homologacao:{disponivel:false,categoria:e instanceof SefazComunicacaoError?e.categoria:'falha-de-consulta',codigoTecnico:e instanceof SefazComunicacaoError?e.codigoTecnico:undefined}}))
  process.exitCode=1
 }
}
verificar().catch(()=>{console.error('Não foi possível validar o A1 ou ler a configuração. Confira as credenciais no ambiente protegido.');process.exitCode=1}).finally(()=>db.$disconnect())
