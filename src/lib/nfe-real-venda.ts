import { z } from 'zod'
import type { pedidoAmazonFiscal } from './amazon-sp-api'
import type { Prisma } from '@prisma/client'
import { validCpfCnpj } from './siggma/customer'
import { PACOTE_NFE } from './nfe-validacao-xsd'
import { validarLiberacaoReal } from './nfe-real-liberacao'
import { gerarNfe55Producao, type NfeEntrada } from './nfe-xml-modelo55'
import { assinarDocumentoFiscal, type ChavesA1 } from './nfe-assinatura-a1'
import { exigir, montarLoteReal } from './nfe-real-protocolo'
import { emailSchema } from './auth-validation'

export const complementoFiscal=z.object({
 endereco:z.object({
  logradouro:z.string().trim().min(2).max(60),numero:z.string().trim().min(1).max(60),
  bairro:z.string().trim().min(2).max(60),municipio:z.string().trim().min(2).max(60),
  codigoMunicipio:z.string().regex(/^35\d{5}$/),uf:z.literal('SP'),cep:z.string().regex(/^\d{8}$/),
  complemento:z.string().trim().max(60).optional(),
 }).strict(),
 pagamento:z.enum(['01','17','18','20']),modalidadeFrete:z.enum(['0','1','2','9']),
 dadosPagamento:z.object({tipoIntegracao:z.enum(['1','2']),cnpjInstituicao:z.string().regex(/^\d{14}$/).optional(),codigoAutorizacao:z.string().trim().min(1).max(128).optional()}).strict().optional(),
 consumidorFinalNaoContribuinte:z.literal(true),semNotaExterna:z.literal(true),
}).strict()
export type ComplementoFiscal=z.infer<typeof complementoFiscal>
export type TransacaoFiscal=Prisma.TransactionClient

export type Intermediacao={pedidoId:string;total:number;cnpj:string;idCadastro:string}
export function conferirAmazon(id:string,total:number,dados:Awaited<ReturnType<typeof pedidoAmazonFiscal>>,cnpj:string){
 const {order,sellerId,marketplaceId}=dados
 exigir(order?.orderId===id&&marketplaceId==='A2Q3Y263D00KWC'&&order.salesChannel?.marketplaceId===marketplaceId,'Pedido ou marketplace Amazon divergente.')
 exigir(order.fulfillment?.fulfilledBy==='MERCHANT'&&order.fulfillment.fulfillmentStatus==='UNSHIPPED'
  &&!order.programs?.includes('INVOICE_BY_AMAZON')&&order.tax?.taxInvoicing?.invoiceStatus==='NOT_FOUND',
  'Amazon não confirmou pedido enviado pelo vendedor, ainda sem expedição e sem NF-e carregada. Confira o faturador.')
 const money=order.proceeds?.grandTotal
 exigir(money?.currencyCode==='BRL'&&Math.round(Number(money.amount)*100)===Math.round(total*100),'Total da Amazon diverge da venda.')
 exigir(/^\d{14}$/.test(cnpj)&&validCpfCnpj(cnpj)&&sellerId.length>=2&&sellerId.length<=60,'Configure o CNPJ fiscal do intermediador Amazon e a identificação do vendedor.')
 return {pedidoId:id,total,cnpj,idCadastro:sellerId}
}
export async function intermediadorAmazon(id:string,total:number){
 const {pedidoAmazonFiscal}=await import('./amazon-sp-api')
 const dados=await pedidoAmazonFiscal(id)
 return conferirAmazon(id,total,dados,process.env.NFE_AMAZON_CNPJ_INTERMEDIADOR?.trim()||'')
}

export async function carregarOperacao(tx:TransacaoFiscal,vendaId:string){
 const venda=await tx.venda.findUnique({where:{id:vendaId},include:{
  itens:{include:{produto:true},orderBy:{id:'asc'}},cliente:true,notaFiscal:true,
 }})
 exigir(venda,'Venda não encontrada.')
 exigir((venda.canal==='site'&&!venda.marketplaceOrderId||venda.canal==='amazon'&&venda.marketplaceOrderId)&&!venda.siggmaGuid,'Venda atendida por outro fluxo fiscal. Confira o emissor do pedido.')
 exigir(venda.status==='concluida'&&venda.total>0&&venda.itens.length,'A venda deve estar concluída e conter mercadorias.')
 exigir(!venda.creditoPresenteCentavos,'Pagamento com vale exige detalhamento próprio.')
 exigir(!venda.mercadoPagoStatus||venda.mercadoPagoStatus==='approved','Pagamento pendente ou estornado no Mercado Pago.')
 exigir(venda.cliente&&validCpfCnpj(venda.cliente.cpfCnpj)&&emailSchema.safeParse(venda.cliente.email).success,'Revise CPF/CNPJ e e-mail do cliente da venda.')
 if(venda.marketplaceBuyerDocument)exigir(venda.marketplaceBuyerDocument.replace(/\D/g,'')===venda.cliente.cpfCnpj?.replace(/\D/g,''),'CPF/CNPJ do pedido Amazon diverge do cliente vinculado.')
 return venda
}
export async function carregarLiberacao(tx:TransacaoFiscal,habilitada:boolean){
 const empresa=await tx.configuracaoFiscal.findUnique({where:{id:'matilha-prado'}})
 exigir(empresa?.uf==='SP'&&empresa.ambiente==='producao'&&empresa.serieNfe===2&&empresa.regimeTributario==='1'&&empresa.apuracaoTributaria==='PGDAS_D','Cadastro fiscal incompatível com NF-e 55 série 2 em produção.')
 const cnpj=empresa.cnpj?.replace(/\D/g,'')??''
 const chave={cnpj,modelo:'55',serie:2,ambiente:1}
 const seq=await tx.nfeRealSequencia.findUnique({where:{cnpj_modelo_serie_ambiente:chave}})
 exigir(seq,'A série 2 aguarda conciliação do histórico de produção.')
 try{validarLiberacaoReal(seq,habilitada&&seq.habilitado)}catch{exigir(false,'Emissão real bloqueada. Confira a liberação e exclusividade da série 2.')}
 exigir(seq.referenciaSchema===PACOTE_NFE,'A liberação precisa corresponder ao pacote XSD instalado.')
 const teste=await tx.nfeHomologacao.findFirst({where:{ambiente:2,serie:2,status:'autorizada',codigoSefaz:{in:[100,150]},protocolo:{not:null},xmlAutorizado:{not:null},chave:{startsWith:'35'}},select:{chave:true},orderBy:{autorizadaEm:'desc'}})
 exigir(teste?.chave.slice(6,20)===cnpj,'Falta autorização em homologação para o emitente.')
 return {empresa,cnpj,seq}
}

export async function gerarParaVenda(tx:TransacaoFiscal,venda:Awaited<ReturnType<typeof carregarOperacao>>,empresa:NonNullable<Awaited<ReturnType<typeof carregarLiberacao>>['empresa']>,dados:ComplementoFiscal,numero:number,cNF:string,data:Date,chaves:ChavesA1,inter?:Intermediacao){
 exigir(venda.canal==='amazon'?inter?.pedidoId===venda.marketplaceOrderId&&inter?.total===venda.total:!inter,'Vínculo ou total do pedido divergente.')
 const cliente=venda.cliente!
 const cep=venda.cepEntrega?.replace(/\D/g,'')
 exigir(!cep||cep===dados.endereco.cep,'CEP fiscal diverge do endereço de entrega. Confira o pedido.')
 const itens:NfeEntrada['itens']=[]
 const hoje=new Date()
 for(const {produto:p} of venda.itens){
  exigir(p.sku&&p.ncm&&p.cfop&&p.origem&&p.gtinFiscal,'Item sem SKU, NCM, CFOP, origem ou GTIN confirmado.')
  const regra=await tx.regraFiscalAprovada.findUnique({where:{ncm_cfop_ufDestino_origem_indicadorIE:{
   ncm:p.ncm,cfop:p.cfop,origem:p.origem,ufDestino:dados.endereco.uf,indicadorIE:'9',
  }},include:{aprovacoesProducao:{where:{sku:p.sku}}}})
  const aprovacao=regra?.aprovacoesProducao[0]
  exigir(regra?.ativo&&aprovacao&&aprovacao.revisaoRegra.getTime()===regra.atualizadoEm.getTime()
   &&(!regra.vigenteDesde||regra.vigenteDesde<=hoje)&&(!regra.vigenteAte||regra.vigenteAte>=hoje),
   'Falta regra fiscal vigente aprovada para produção no SKU '+p.sku+'.')
  exigir(p.csosn==='102'&&regra.csosn===p.csosn&&regra.cest===p.cest&&regra.pisCst===p.pisCst&&regra.cofinsCst===p.cofinsCst,
   'O cadastro do SKU '+p.sku+' diverge da regra aprovada.')
  exigir(![p.ipiCst,p.ibsCbsCst,p.ibsCbsClassTrib,regra.ipiCst,regra.ibsCbsCst,regra.ibsCbsClassTrib].some(Boolean)
   &&[regra.aliquotaIcmsSt,regra.aliquotaFcpSt,regra.aliquotaIpi,regra.aliquotaIbsUf,regra.aliquotaIbsMun,regra.aliquotaCbs].every(v=>v==null),
   'A regra exige grupos tributários adicionais para o SKU '+p.sku+'.')
  const outras=(cst:string,aliquota:number|null)=>{
   if(cst==='49'){
    exigir(aliquota===0&&aprovacao.baseZeroCst49,'CST 49 requer aprovação explícita da base e da alíquota zero para esta operação.')
    return {base:0,aliquota:0,valor:0}
   }
   exigir(['04','05','06','07','08','09'].includes(cst)&&!aliquota,'CST exige outro tratamento.')
   return undefined
  }
  itens.push({produtoId:p.id,gtin:p.gtinFiscal,pisCst:regra.pisCst,cofinsCst:regra.cofinsCst,
   pis:outras(regra.pisCst,regra.aliquotaPis),cofins:outras(regra.cofinsCst,regra.aliquotaCofins)})
 }
 const {xml,chave}=gerarNfe55Producao(venda,empresa,{
  numero,codigoNumerico:cNF,intermediador:inter&&{cnpj:inter.cnpj,idCadastro:inter.idCadastro},naturezaOperacao:'Venda de mercadoria',consumidorFinal:'1',
  destinatario:{nome:cliente.nome,documento:cliente.cpfCnpj!,indicadorIE:'9',endereco:dados.endereco},
  modalidadeFrete:dados.modalidadeFrete,pagamento:dados.pagamento,dadosPagamento:dados.dadosPagamento,itens,
 },data)
 const {xmlAssinado}=assinarDocumentoFiscal(xml,chaves,1)
 montarLoteReal(xmlAssinado,numero)
 return {xmlAssinado,chave,xml}
}
