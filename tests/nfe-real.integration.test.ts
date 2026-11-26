import { beforeAll, afterAll, test, expect } from 'bun:test'
import { PrismaClient } from '@prisma/client'
import forge from 'node-forge'
import { emissorReal, emissaoAtivaNoServidor } from '../src/lib/nfe-real-servico'
import { conferirAmazon, type ComplementoFiscal } from '../src/lib/nfe-real-venda'
import { gerarDanfeAutorizado } from '../src/lib/nfe-danfe'
import { interpretarRetornoReal, inutilizacaoDisponivel, retornoInutilizacao, NFE_NS } from '../src/lib/nfe-real-protocolo'
import { dispatchNfeEmails } from '../src/lib/fiscal-nfe-email'
import { PACOTE_NFE } from '../src/lib/nfe-validacao-xsd'
import { enviarSoapProducao, type ServicoReal } from '../src/lib/sefaz-sp-nfe-homologacao'

const banco=new URL(process.env.DATABASE_URL||'about:blank')
if(!['localhost','127.0.0.1'].includes(banco.hostname)||banco.pathname!=='/matilha_auth_test'||process.env.VERCEL)
 throw Error('Execute somente no PostgreSQL local matilha_auth_test com serviços externos simulados.')
const db=new PrismaClient()
const cnpj='11222333000181',serie={cnpj,modelo:'55',serie:2,ambiente:1}
const protocolo='135260000000001',eventoProt='135260000000002'
const sku='TESTE-NFE-55'
const dados:ComplementoFiscal={pagamento:'01',modalidadeFrete:'9',consumidorFinalNaoContribuinte:true,semNotaExterna:true,
 endereco:{uf:'SP',municipio:'São Paulo',codigoMunicipio:'3550308',logradouro:'Rua de Teste',numero:'50',bairro:'Centro',cep:'01001000'}}
const par=forge.pki.rsa.generateKeyPair(1024),cert=forge.pki.createCertificate()
cert.publicKey=par.publicKey;cert.serialNumber='01'
cert.setSubject([{name:'commonName',value:'Teste'}]);cert.setIssuer(cert.subject.attributes);cert.sign(par.privateKey)
const chaves={privateKeyPem:forge.pki.privateKeyToPem(par.privateKey),certificadoPem:forge.pki.certificateToPem(cert),cnpj,venceEm:'2035-01-01'}
let clienteId:string,produtoId:string,regraId:string,habilitado=true
type Enviar=(op:ServicoReal,xml:string)=>Promise<string>
let transporte:Enviar=async()=>{throw Error('Transporte inesperado no teste')}
const servico=emissorReal({db,amazon:async()=>{throw Error('Amazon não consultada nestes testes do site')},habilitado:()=>habilitado,chaves:()=>chaves,enviar:(op,xml)=>transporte(op,xml)})
async function venda(canal='site'){
 return db.venda.create({data:{clienteId,canal,total:10,subtotalProdutos:10,status:'concluida',itens:{create:{produtoId,quantidade:1,precoUnit:10}}}})
}
function resposta(chave:string,assinado:string,codigo=100){
 const dig=assinado.match(/<DigestValue>([^<]+)/)?.[1]
 return '<retEnviNFe xmlns="'+NFE_NS+'" versao="4.00"><tpAmb>1</tpAmb><cStat>104</cStat><xMotivo>Lote processado</xMotivo><protNFe versao="4.00"><infProt><tpAmb>1</tpAmb><verAplic>SP_TESTE</verAplic><chNFe>'+chave+
  '</chNFe><dhRecbto>2026-11-25T18:22:10-03:00</dhRecbto><nProt>'+protocolo+'</nProt><digVal>'+dig+'</digVal><cStat>'+codigo+'</cStat><xMotivo>Resultado de teste</xMotivo></infProt></protNFe></retEnviNFe>'
}
function consulta(chave:string,codigo:number){
 return '<retConsSitNFe xmlns="'+NFE_NS+'"><tpAmb>1</tpAmb><cUF>35</cUF><cStat>'+codigo+'</cStat><chNFe>'+chave+'</chNFe><xMotivo>Consulta de teste</xMotivo></retConsSitNFe>'
}
beforeAll(async()=>{
 // O teste exige uma instalação fiscal vazia. Nunca sobrescreve configuração de outro ambiente.
 expect(await db.configuracaoFiscal.count()).toBe(0)
 await db.configuracaoFiscal.create({data:{cnpj,regimeTributario:'1',apuracaoTributaria:'PGDAS_D',razaoSocial:'Loja de teste',
  inscricaoEstadual:'150787370115',uf:'SP',cidade:'São Paulo',cep:'01001000',codigoMunicipio:'3550308',serieNfe:2,ambiente:'producao',logradouro:'Rua de Teste',numeroEndereco:'10',bairro:'Centro'}})
 await db.nfeHomologacao.create({data:{ambiente:2,serie:2,numero:4,chave:'352611'+cnpj+'550020000000041123456789',produtoId:sku,quantidade:1,valorUnitario:10,
  status:'autorizada',codigoSefaz:100,protocolo,xmlAssinado:'teste',xmlAutorizado:'teste'}})
 await db.nfeRealSequencia.create({data:{...serie,primeiroNumero:1,proximoNumero:1,referenciaContabil:'parecer de teste',referenciaNumeracao:'base local isolada',referenciaSchema:PACOTE_NFE,exclusivo:true,habilitado:true}})
 clienteId=(await db.cliente.create({data:{nome:'Cliente de teste',telefone:'11999999999',email:'nfe@example.test',cpfCnpj:'12345678909'}})).id
 produtoId=(await db.produto.create({data:{sku,nome:'Produto teste',preco:10,categoria:'teste',ncm:'39269090',origem:'0',cfop:'5102',csosn:'102',gtinFiscal:'SEM GTIN',unidadeFiscal:'UN',pisCst:'49',cofinsCst:'49'}})).id
 regraId=(await db.regraFiscalAprovada.create({data:{ncm:'39269090',origem:'0',cfop:'5102',csosn:'102',pisCst:'49',cofinsCst:'49',aliquotaPis:0,aliquotaCofins:0,contadorResponsavel:'Teste local',referencia:'Apenas teste local'}})).id
})
afterAll(async()=>{await db.$disconnect()})
test('regra de homologação, desligamento e marketplaces não consomem sequência',async()=>{
 const v=await venda()
 await expect(servico.preparar(v.id,'admin-teste',dados)).rejects.toThrow('produção no SKU')
 const regra=await db.regraFiscalAprovada.findUniqueOrThrow({where:{id:regraId}})
 await db.nfeRealAprovacao.create({data:{sku,regraId,baseZeroCst49:true,revisaoRegra:regra.atualizadoEm,referencia:'Aprovação sintética para este SKU e tratamento zero'}})
 habilitado=false
 await expect(servico.preparar(v.id,'admin-teste',dados)).rejects.toThrow('bloqueada')
 habilitado=true
 const externa=await venda('mercado_livre')
 await expect(servico.preparar(externa.id,'admin-teste',dados)).rejects.toThrow('outro fluxo')
 expect((await db.nfeRealSequencia.findFirstOrThrow()).proximoNumero).toBe(1)
 expect(await db.nfeRealReserva.count()).toBe(0)
 expect(emissaoAtivaNoServidor()).toBe(false)
 expect(()=>enviarSoapProducao('autorizacao','', {pfx:Buffer.alloc(0),passphrase:''})).toThrow()
})
test('concorrência entre vendas e cliques, falha antes do commit e XML/PDF após autorização',async()=>{
 const v=await venda(),outra=await venda()
 await expect(servico.preparar(v.id,'admin',{...dados,endereco:{...dados.endereco,logradouro:''}})).rejects.toThrow()
 const pedidos=[...Array.from({length:10},()=>v.id),outra.id]
 const preparos=await Promise.all(pedidos.map(id=>servico.preparar(id,'admin',dados)))
 expect(new Set(preparos.map(p=>p.numero))).toEqual(new Set([1,2]))
 expect(new Set(preparos.slice(0,10).map(p=>p.chave)).size).toBe(1)
 expect((await db.nfeRealSequencia.findFirstOrThrow()).proximoNumero).toBe(3)
 const reserva=await db.nfeRealReserva.findUniqueOrThrow({where:{vendaId:v.id}})
 const xml=reserva.xmlAssinado!,chave=reserva.chave!,ok=resposta(chave,xml)
 expect(xml).toContain('<xNome>Cliente de teste</xNome>')
 expect(()=>interpretarRetornoReal(ok.replace('<tpAmb>1','<tpAmb>2'),'autorizacao',chave,xml,null)).toThrow()
 expect(()=>interpretarRetornoReal(ok.replace('<digVal>','<digVal>X'),'autorizacao',chave,xml,null)).toThrow()
 let chamadas=0
 transporte=async(op,lote)=>{expect(op).toBe('autorizacao');expect(lote).toContain(xml);chamadas++;return ok}
 await Promise.all(Array.from({length:10},()=>servico.enviar(v.id,'admin')))
 expect(chamadas).toBe(1)
 const nota=await db.notaFiscal.findUniqueOrThrow({where:{vendaId:v.id},include:{entregaEmail:true}})
 expect(nota.status).toBe('autorizada');expect(nota.protocolo).toBe(protocolo);expect(nota.entregaEmail?.status).toBe('pendente')
 const pdf=gerarDanfeAutorizado(nota.xmlAutorizado!)
 expect(pdf.subarray(0,5).toString()).toBe('%PDF-')
 let emails=0
 const envia:typeof fetch=Object.assign(async(_url:unknown,init?:RequestInit)=>{
  const payload=JSON.parse(String(init?.body))
  expect(payload.attachments.map((v:{filename:string})=>v.filename)).toEqual(['DANFE-'+chave+'.pdf','NFe-'+chave+'.xml'])
  expect(Buffer.from(payload.attachments[0].content,'base64').equals(pdf)).toBe(true)
  expect(Buffer.from(payload.attachments[1].content,'base64').toString()).toBe(nota.xmlAutorizado!)
  emails++;return Response.json({id:'id-local'})
 },{preconnect:fetch.preconnect})
 const cfg={key:'teste-local',from:'teste@example.test',origin:'https://example.test',replyTo:undefined,configured:true}
 await Promise.all([dispatchNfeEmails(envia,cfg),dispatchNfeEmails(envia,cfg)])
 expect(emails).toBe(1)
 transporte=async(op,doc)=>{
  expect(op).toBe('cancelamento');expect(doc).toContain('ID110111'+chave+'01')
  return '<retEnvEvento xmlns="'+NFE_NS+'" versao="1.00"><tpAmb>1</tpAmb><cStat>128</cStat><retEvento versao="1.00"><infEvento><tpAmb>1</tpAmb><verAplic>SP_TESTE</verAplic><cOrgao>35</cOrgao><cStat>135</cStat><xMotivo>Evento registrado</xMotivo><chNFe>'+chave+'</chNFe><tpEvento>110111</tpEvento><xEvento>Cancelamento</xEvento><nSeqEvento>1</nSeqEvento><dhRegEvento>2026-11-25T19:22:10-03:00</dhRegEvento><nProt>'+eventoProt+'</nProt></infEvento></retEvento></retEnvEvento>'
 }
 const cancelada=await servico.cancelar(v.id,'admin','Pedido cancelado antes da circulação da mercadoria')
 expect(cancelada.status).toBe('cancelada')
 const evento=await db.nfeRealCancelamento.findUniqueOrThrow({where:{reservaId:reserva.id}})
 expect(evento.protocolo).toBe(eventoProt);expect(evento.xmlProcessado).toContain('<procEventoNFe')
 await expect(servico.registrarQuebra(v.id,'admin','Quebra em nota já autorizada')).rejects.toThrow()
},30000)
test('timeout, consulta 217, reenvio do mesmo XML, rejeição corrigível e quebra de sequência',async()=>{
 const v=await venda(),r=await servico.preparar(v.id,'admin',dados)
 const lotes:string[]=[]
 transporte=async(_op,xml)=>{lotes.push(xml);throw Error('timeout simulado')}
 expect((await servico.enviar(v.id,'admin')).status).toBe('incerta')
 await expect(servico.enviar(v.id,'admin',true)).rejects.toThrow('Reenvio')
 transporte=async()=>consulta(r.chave!,217)
 expect((await servico.consultar(v.id,'admin')).podeReenviar).toBe(false)
 await db.nfeRealReserva.update({where:{vendaId:v.id},data:{enviadaEm:new Date(Date.now()-181000)}})
 expect((await servico.consultar(v.id,'admin')).podeReenviar).toBe(true)
 const original=await db.nfeRealReserva.findUniqueOrThrow({where:{vendaId:v.id}})
 transporte=async(_op,xml)=>{lotes.push(xml);return resposta(r.chave!,original.xmlAssinado!,434)}
 expect((await servico.enviar(v.id,'admin',true)).status).toBe('rejeitada')
 expect(lotes[0]).toBe(lotes[1])
 const corr=await servico.preparar(v.id,'admin',{...dados,pagamento:'18'},true)
 expect(corr.chave).toBe(r.chave);expect(corr.numero).toBe(r.numero)
 transporte=async()=>resposta(r.chave!,original.xmlAssinado!,434)
 await servico.enviar(v.id,'admin');expect((await servico.registrarQuebra(v.id,'admin','Quebra fiscal registrada localmente')).status).toBe('quebra')
 expect((await db.nfeRealSequencia.findFirstOrThrow()).proximoNumero).toBe(r.numero+1)
},20000)

test('Amazon valida pedido e emissor e escreve o intermediador no XML assinado',async()=>{
 const v=await venda('amazon'),pedidoId='701-1111111-2222222'
 await db.venda.update({where:{id:v.id},data:{marketplaceOrderId:pedidoId}})
 const marketplaceId='A2Q3Y263D00KWC',sellerId='LOJA_DE_TESTE'
 const order={orderId:pedidoId,salesChannel:{marketplaceId},fulfillment:{fulfilledBy:'MERCHANT',fulfillmentStatus:'UNSHIPPED'},proceeds:{grandTotal:{amount:10,currencyCode:'BRL'}},tax:{taxInvoicing:{invoiceStatus:'NOT_FOUND'}}}
 const resp={order,marketplaceId,sellerId}
 for(const alteracao of [{fulfillment:{fulfilledBy:'AMAZON'}},{tax:{taxInvoicing:{invoiceStatus:'ACCEPTED'}}},{programs:['INVOICE_BY_AMAZON']}]){
  expect(()=>conferirAmazon(pedidoId,10,{...resp,order:{...order,...alteracao}},cnpj)).toThrow()
 }
 const s=emissorReal({db,amazon:async(id,total)=>conferirAmazon(id,total,resp,cnpj),habilitado:()=>true,chaves:()=>chaves,enviar:async()=>{throw Error('sem rede')}})
 await s.preparar(v.id,'admin',dados)
 const reserva=await db.nfeRealReserva.findUniqueOrThrow({where:{vendaId:v.id}})
 expect(reserva.xmlAssinado).toContain('<indIntermed>1</indIntermed>')
 expect(reserva.xmlAssinado).toContain('<idCadIntTran>'+sellerId+'</idCadIntTran>')
})

test('inutilização de transição somente na quebra, com faixa e protocolo conferidos',async()=>{
 expect(inutilizacaoDisponivel(new Date('2027-04-02T10:00:00Z'))).toBe(false)
 const v=await venda(),agora=new Date('2026-11-26T12:00:00-03:00')
 let respostaXml='',solicitacoes=0
 const s=emissorReal({db,agora:()=>agora,amazon:async()=>{throw Error('sem Amazon')},habilitado:()=>true,chaves:()=>chaves,enviar:async(op,pedido)=>{
  expect(op).toBe('inutilizacao');solicitacoes++
  const campo=(k:string)=>pedido.match(new RegExp('<'+k+'>([^<]+)</'+k+'>'))![1]
  respostaXml='<retInutNFe xmlns="'+NFE_NS+'" versao="4.00"><infInut><tpAmb>1</tpAmb><verAplic>SP_TESTE</verAplic><cStat>102</cStat><xMotivo>Inutilizacao de numero homologado</xMotivo><cUF>35</cUF><ano>'+campo('ano')+'</ano><CNPJ>'+cnpj+'</CNPJ><mod>55</mod><serie>2</serie><nNFIni>'+campo('nNFIni')+'</nNFIni><nNFFin>'+campo('nNFFin')+'</nNFFin><dhRecbto>2026-11-26T12:00:00-03:00</dhRecbto><nProt>'+protocolo+'</nProt></infInut></retInutNFe>'
  return respostaXml
 }})
 const r=await s.preparar(v.id,'admin',dados),motivo='Descontinuidade documentada no teste isolado'
 await expect(s.inutilizar(v.id,'admin',motivo)).rejects.toThrow('quebra')
 await s.registrarQuebra(v.id,'admin',motivo)
 const chamadas=await Promise.allSettled([s.inutilizar(v.id,'admin',motivo),s.inutilizar(v.id,'admin',motivo)])
 expect(solicitacoes).toBe(1)
 expect(chamadas.some(x=>x.status==='fulfilled'&&x.value.status==='inutilizada')).toBe(true)
 const salva=await db.nfeRealReserva.findUniqueOrThrow({where:{vendaId:v.id},include:{inutilizacao:true}})
 expect(salva.inutilizacao?.protocolo).toBe(protocolo)
 expect(salva.inutilizacao?.xmlProcessado).toContain('<ProcInutNFe')
 expect(()=>retornoInutilizacao(respostaXml.replace('<serie>2</serie>','<serie>3</serie>'),salva.inutilizacao!.xmlPedido)).toThrow()
 expect((await db.nfeRealSequencia.findFirstOrThrow()).proximoNumero).toBe(r.numero+1)
})

test('recibo assíncrono e duplicidade sem protocolo não autorizam',()=>{
 const chave='1'.repeat(44),recibo='135260000000001'
 const xml='<retEnviNFe xmlns="'+NFE_NS+'"><tpAmb>1</tpAmb><cStat>103</cStat><infRec><nRec>'+recibo+'</nRec></infRec></retEnviNFe>'
 expect(interpretarRetornoReal(xml,'autorizacao',chave,'',null)).toMatchObject({status:'recebida',recibo,xmlAutorizado:null})
 expect(interpretarRetornoReal(xml.replace('103','204'),'autorizacao',chave,'',null).status).toBe('incerta')
})
