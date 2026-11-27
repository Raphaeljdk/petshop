import { randomInt } from 'node:crypto'
import type { NfeRealReserva, PrismaClient } from '@prisma/client'
import { db } from './db'
import { extrairCertificadoA1, verificarNfeAssinada, type ChavesA1 } from './nfe-assinatura-a1'
import { lerA1DeVariaveis } from './sefaz-sp-nfe'
import { enviarSoapProducao, type ServicoReal } from './sefaz-sp-nfe-homologacao'
import { consultaReal, exigir, interpretarRetornoReal, inutilizacaoDisponivel, pedidoInutilizacao, retornoInutilizacao, loteCancelamento, montarLoteReal, pedidoCancelamento, retornoCancelamento } from './nfe-real-protocolo'
import { intermediadorAmazon, carregarLiberacao, carregarOperacao, complementoPersistido, compradorFiscal, contatoCompleto, numeroPedidoAmazon, gerarParaVenda, type ComplementoFiscal, type TransacaoFiscal } from './nfe-real-venda'
import { configuracaoEmailFiscal, emailParaEntrega } from './fiscal-nfe-email'

type Runtime={agora?:()=>Date;amazon:typeof intermediadorAmazon; db:PrismaClient; habilitado:()=>boolean; chaves:(cnpj:string)=>ChavesA1; enviar:(servico:ServicoReal,xml:string)=>Promise<string>}
export function emissaoAtivaNoServidor(){
 return process.env.VERCEL_ENV==='production'&&process.env.NODE_ENV!=='test'&&process.env.NFE_REAL_HABILITADA==='true'
  &&process.env.NFE_EMAIL_AUTOMATICO_ENABLED==='true'&&configuracaoEmailFiscal().configured
}
function credenciais(){
 return lerA1DeVariaveis({SEFAZ_NFE_A1_PFX_BASE64:process.env.SEFAZ_NFE_A1_PFX_BASE64,SEFAZ_NFE_A1_SENHA:process.env.SEFAZ_NFE_A1_SENHA})
}
const padrao:Runtime={db,amazon:intermediadorAmazon,habilitado:emissaoAtivaNoServidor,chaves:cnpj=>{
 const cred=credenciais()
 return extrairCertificadoA1(cred.pfx,cred.passphrase,cnpj)
},enviar:(op,xml)=>enviarSoapProducao(op,xml,credenciais())}

function registro(tx:TransacaoFiscal,r:NfeRealReserva,acao:string,usuarioId:string,documento?:string){
 return tx.nfeRealHistorico.create({data:{reservaId:r.id,acao,usuarioId,documento}})
}
function notaPropria(tx:TransacaoFiscal,vendaId:string){
 return tx.notaFiscal.findFirstOrThrow({where:{vendaId,emissor:'matilha_prado',modelo:'55'}})
}
function rascunhoLivre(nota:Awaited<ReturnType<typeof carregarOperacao>>['notaFiscal']){
 return !nota||nota.modelo==='55'&&nota.status==='rascunho'&&!nota.emissor&&!nota.numero&&!nota.chaveAcesso
  &&!nota.protocolo&&!nota.xmlAutorizado&&!nota.emissorDocumentoId&&!nota.emissaoSolicitadaEm
}
async function travarVenda(tx:TransacaoFiscal,id:string){
 const linhas=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Venda" WHERE id=${id} FOR UPDATE`
 exigir(linhas.length===1,'Venda não encontrada.')
}
const prazoConsulta=180_000
function podeReenviar(r:NfeRealReserva){
 return r.status==='incerta'&&r.codigo===217&&!r.recibo&&!!r.enviadaEm&&!!r.consultaAusenteEm
  &&r.consultaAusenteEm.getTime()-r.enviadaEm.getTime()>=prazoConsulta
}
export function resumoReal(r:NfeRealReserva){
 return {status:r.status,numero:r.numero,serie:r.serie,chave:r.chave,codigo:r.codigo,motivo:r.motivo,podeReenviar:podeReenviar(r)}
}

export function emissorReal(rt:Runtime=padrao){
 const transacao=<T,>(fn:(tx:TransacaoFiscal)=>Promise<T>)=>rt.db.$transaction(fn,{isolationLevel:'ReadCommitted',maxWait:12000,timeout:25000})
 async function intermediacao(vendaId:string){
  const venda=await rt.db.venda.findUnique({where:{id:vendaId},select:{canal:true,marketplaceOrderId:true,total:true,cliente:{select:{cpfCnpj:true,email:true}}}})
  if(venda?.canal!=='amazon')return undefined
  return rt.amazon(numeroPedidoAmazon(venda.marketplaceOrderId),venda.total,!contatoCompleto(venda.cliente))
 }
 async function conferirPedidoAmazon(vendaId:string){
  const venda=await carregarOperacao(rt.db,vendaId)
  exigir(venda.canal==='amazon','Selecione uma venda da Amazon.')
  exigir(rascunhoLivre(venda.notaFiscal),'Já existe um documento ou uma emissão em andamento para esta venda.')
  const inter=await intermediacao(vendaId)
  compradorFiscal(venda,inter)
  return {pedido:numeroPedidoAmazon(venda.marketplaceOrderId)}
 }
 async function preparar(vendaId:string,autor:string,dados:ComplementoFiscal,corrigir=false){
  const existente=await rt.db.nfeRealReserva.findUnique({where:{vendaId}})
  if(existente&&!corrigir)return resumoReal(existente)
  exigir(rt.habilitado(),'Emissão real bloqueada.')
  const inter=await intermediacao(vendaId)
  return transacao(async tx=>{
   await travarVenda(tx,vendaId)
   const anterior=await tx.nfeRealReserva.findUnique({where:{vendaId}})
   if(anterior&&!corrigir)return resumoReal(anterior)
   if(corrigir)exigir(anterior&&(anterior.status==='rejeitada'||anterior.status==='preparada'&&!anterior.enviadaEm),'Correção exige NF-e ainda não transmitida ou rejeição confirmada.')
   const venda=await carregarOperacao(tx,vendaId)
   const nota=venda.notaFiscal
   exigir(anterior?nota?.emissor==='matilha_prado'&&nota.status===anterior.status:rascunhoLivre(nota),
    'Já existe um documento ou uma emissão em andamento para esta venda.')
   // O bloqueio da sequência vem depois do bloqueio da venda em todos os caminhos de reserva.
   // A leitura seguinte vê a versão confirmada pelo emissor concorrente.
   await tx.$queryRaw`SELECT serie FROM "NfeRealSequencia" WHERE serie=2 AND ambiente=1 FOR UPDATE`
   const {empresa,cnpj,seq}=await carregarLiberacao(tx,rt.habilitado())
   const numero=anterior?.numero??seq.proximoNumero
   exigir(numero<=999999999,'Numeração da série esgotada.')
   if(!anterior){
    const conflito=await tx.$queryRaw<{existe:boolean}[]>`SELECT EXISTS(
     SELECT 1 FROM "NotaFiscal" WHERE modelo='55' AND (
      (serie=2 AND numero>=${numero}) OR (substring("chaveAcesso",7,14)=${cnpj} AND substring("chaveAcesso",21,5)='55002' AND substring("chaveAcesso",26,9)>=${String(numero).padStart(9,'0')}))
     UNION ALL SELECT 1 FROM "NfeRealReserva" WHERE cnpj=${cnpj} AND serie=2 AND numero>=${numero}
    ) AS existe`
    exigir(!conflito[0].existe,'Numeração divergente do histórico. Concilie a série antes de emitir.')
   }
   const data=anterior?.emitidaEm??new Date()
   const cNF=anterior?.chave?.slice(35,43)??String(randomInt(100000000)).padStart(8,'0')
   const {chave,xmlAssinado,emailPedidoAmazon}=await gerarParaVenda(tx,venda,empresa,dados,numero,cNF,data,rt.chaves(cnpj),inter)
   exigir(!anterior||chave===anterior.chave,'Correção alteraria a chave reservada.')
   const dadosOperacao=emailPedidoAmazon?{...dados,emailPedidoAmazon}:dados
   const valores={status:'preparada',chave,xmlAssinado,dadosOperacao,emitidaEm:data,codigo:null,motivo:null,recibo:null,consultaAusenteEm:null}
   const r=anterior?await tx.nfeRealReserva.update({where:{vendaId},data:{...valores,revisao:{increment:1}}}):
    await tx.nfeRealReserva.create({data:{...valores,cnpj,serie:2,numero,vendaId}})
   if(!anterior)await tx.nfeRealSequencia.update({where:{cnpj_modelo_serie_ambiente:{cnpj,modelo:'55',serie:2,ambiente:1}},data:{proximoNumero:{increment:1},updatedAt:new Date()}})
   const nf={emissor:'matilha_prado',status:'preparada',numero,serie:2,chaveAcesso:chave,erro:null}
   if(nota){
    const mudou=await tx.notaFiscal.updateMany({where:{id:nota.id,status:nota.status,emissor:nota.emissor,chaveAcesso:nota.chaveAcesso},data:nf})
    exigir(mudou.count===1,'A venda foi conciliada por outro emissor.')
   }else await tx.notaFiscal.create({data:{...nf,vendaId,modelo:'55'}})
   await registro(tx,r,corrigir?'corrigir':'preparar',autor,xmlAssinado)
   return resumoReal(r)
  })
 }

 async function aplicar(r:NfeRealReserva,autor:string,op:'autorizacao'|'consulta'|'retorno',resposta:string){
  const resultado=interpretarRetornoReal(resposta,op,r.chave!,r.xmlAssinado!,r.recibo)
  return transacao(async tx=>{
   await travarVenda(tx,r.vendaId)
   const atual=await tx.nfeRealReserva.findUniqueOrThrow({where:{id:r.id}})
   if(atual.revisao!==r.revisao)return resumoReal(atual)
   const {status,codigo,motivo,recibo,xmlAutorizado,protocolo,autorizadaEm}=resultado
   const nf=await notaPropria(tx,r.vendaId)
   const atualizado=await tx.nfeRealReserva.update({where:{id:r.id},data:{status,codigo,motivo,recibo:recibo||r.recibo,
    consultaAusenteEm:resultado.ausente?new Date():null,revisao:{increment:1}}})
   await tx.notaFiscal.update({where:{id:nf.id},data:{status,consultadaEm:new Date(),erro:status==='autorizada'?null:motivo,
    ...(xmlAutorizado?{xmlAutorizado,protocolo,autorizadaEm,danfeUrl:'/api/admin/fiscal/real?vendaId='+encodeURIComponent(r.vendaId)+'&arquivo=pdf'}:{})}})
   if(xmlAutorizado){
    const venda=await tx.venda.findUniqueOrThrow({where:{id:r.vendaId},select:{canal:true,cliente:{select:{email:true}}}})
    const email=emailParaEntrega(venda,atual.dadosOperacao)
    if(email.success)await tx.nfeEmailDelivery.createMany({data:[{notaFiscalId:nf.id,destinatarioEmail:email.data}],skipDuplicates:true})
   }
   await registro(tx,r,op,autor,resposta)
   return resumoReal(atualizado)
  })
 }
 async function enviar(vendaId:string,autor:string,retransmitir=false){
  exigir(rt.habilitado(),'Emissão real desativada.')
  const existente=await rt.db.nfeRealReserva.findUnique({where:{vendaId}})
  if(!retransmitir&&existente&&existente.status!=='preparada')return resumoReal(existente)
  const inter=retransmitir?undefined:await intermediacao(vendaId)
  const tentativa=await transacao(async tx=>{
   await travarVenda(tx,vendaId)
   const r=await tx.nfeRealReserva.findUnique({where:{vendaId}})
   exigir(r?.xmlAssinado&&r.chave&&r.emitidaEm,'Prepare a NF-e desta venda.')
   if(!retransmitir && r.status!=='preparada')return {r,xml:null}
   exigir(retransmitir?podeReenviar(r):r.status==='preparada','Reenvio exige consulta 217 pelo menos três minutos após a tentativa, sem recibo.')
   const {empresa}=await carregarLiberacao(tx,rt.habilitado())
   const venda=await carregarOperacao(tx,vendaId)
   exigir(venda.notaFiscal?.emissor==='matilha_prado'&&venda.notaFiscal.chaveAcesso===r.chave,'Vínculo fiscal da venda divergente.')
   const chaves=rt.chaves(r.cnpj)
   verificarNfeAssinada(r.xmlAssinado,chaves.certificadoPem,r.chave,1)
   if(!retransmitir){
    const dados=complementoPersistido.parse(r.dadosOperacao)
    const atual=await gerarParaVenda(tx,venda,empresa,dados,r.numero,r.chave.slice(35,43),r.emitidaEm,chaves,inter)
    exigir(atual.emailPedidoAmazon===dados.emailPedidoAmazon,'O contato fiscal da Amazon mudou. Confira o pedido antes de transmitir.')
    exigir(atual.xmlAssinado===r.xmlAssinado,'Venda ou regra alterada depois do preparo. Confira os dados antes do envio.')
   }
   const xml=montarLoteReal(r.xmlAssinado,r.numero)
   const claimed=await tx.nfeRealReserva.update({where:{id:r.id},data:{status:'enviando',enviadaEm:new Date(),consultaAusenteEm:null,codigo:null,revisao:{increment:1}}})
   await tx.notaFiscal.update({where:{vendaId},data:{status:'enviando',emissaoSolicitadaEm:new Date()}})
   await registro(tx,r,retransmitir?'retransmitir':'transmitir',autor)
   return {r:claimed,xml}
  })
  if(!tentativa.xml)return resumoReal(tentativa.r)
  try{
   const resposta=await rt.enviar('autorizacao',tentativa.xml)
   return await aplicar(tentativa.r,autor,'autorizacao',resposta)
  }catch{
   return transacao(async tx=>{
    await travarVenda(tx,vendaId)
    const r=await tx.nfeRealReserva.findUniqueOrThrow({where:{vendaId}})
    if(r.revisao!==tentativa.r.revisao)return resumoReal(r)
    const motivo='Transmissão sem confirmação. Consulte a mesma chave.'
    await tx.notaFiscal.update({where:{vendaId},data:{status:'incerta',erro:motivo}})
    await registro(tx,r,'transmissao_sem_confirmacao',autor)
    return resumoReal(await tx.nfeRealReserva.update({where:{vendaId},data:{status:'incerta',motivo,revisao:{increment:1}}}))
   })
  }
 }

 async function finalizarEvento(r:NfeRealReserva,autor:string,pedido:string,resposta:string,consulta=false){
  const resultado=retornoCancelamento(resposta,r.chave!,pedido,consulta)
  if(!resultado)return
  await transacao(async tx=>{
   await travarVenda(tx,r.vendaId)
   const mudanca=await tx.nfeRealCancelamento.updateMany({where:{reservaId:r.id,status:{in:['enviando','incerta']},xmlPedido:pedido},data:resultado})
   if(!mudanca.count)return
   if(resultado.status==='registrada'){
    await tx.nfeRealReserva.update({where:{id:r.id},data:{status:'cancelada',revisao:{increment:1}}})
    await tx.notaFiscal.update({where:{vendaId:r.vendaId},data:{status:'cancelada',canceladaEm:new Date()}})
   }
   await registro(tx,r,'retorno_cancelamento',autor,resposta)
  })
 }
 async function consultar(vendaId:string,autor:string){
  const r=await rt.db.nfeRealReserva.findUnique({where:{vendaId},include:{cancelamento:true}})
  exigir(r?.chave&&r.xmlAssinado,'Venda sem NF-e própria.')
  const evento=r.cancelamento
  if(evento&&['enviando','incerta'].includes(evento.status)){
   const c=consultaReal(r.chave,null),resposta=await rt.enviar(c.operacao,c.xml)
   await finalizarEvento(r,autor,evento.xmlPedido,resposta,true)
  }else if(['incerta','recebida','enviando'].includes(r.status)){
   exigir(r.status!=='enviando'||!r.enviadaEm||Date.now()-r.enviadaEm.getTime()>=prazoConsulta,'Transmissão em andamento.')
   const c=consultaReal(r.chave,r.codigo===106?null:r.recibo),resposta=await rt.enviar(c.operacao,c.xml)
   return aplicar(r,autor,c.operacao,resposta)
  }
  return resumoReal(await rt.db.nfeRealReserva.findUniqueOrThrow({where:{vendaId}}))
 }
 async function cancelar(vendaId:string,autor:string,justificativa:string){
  const tentativa=await transacao(async tx=>{
   await travarVenda(tx,vendaId)
   const r=await tx.nfeRealReserva.findUnique({where:{vendaId},include:{cancelamento:true}})
   exigir(r?.chave&&r.status==='autorizada','Cancelamento exige NF-e própria autorizada.')
   const nota=await notaPropria(tx,vendaId)
   exigir(nota.protocolo&&nota.autorizadaEm,'Autorização incompleta.')
   const venda=await tx.venda.findUniqueOrThrow({where:{id:vendaId},select:{statusEntrega:true}})
   exigir(!['enviada','entregue','retirada','em_transito','em_rota'].includes(venda.statusEntrega||''),'O pedido registra circulação da mercadoria. Confira a operação fiscal.')
   exigir(!r.cancelamento||r.cancelamento.status==='rejeitada','Já existe pedido de cancelamento. Consulte a chave.')
   const pedido=pedidoCancelamento(r.chave,nota.protocolo,justificativa,rt.chaves(r.cnpj),new Date())
   await tx.nfeRealCancelamento.upsert({where:{reservaId:r.id},create:{reservaId:r.id,status:'enviando',xmlPedido:pedido},update:{status:'enviando',xmlPedido:pedido,motivo:null}})
   await registro(tx,r,'solicitar_cancelamento',autor,pedido)
   return {r,pedido}
  })
  return transmitirEvento(tentativa.r,tentativa.pedido,autor)
 }
 async function transmitirEvento(r:NfeRealReserva,pedido:string,autor:string){
  try{
   const resposta=await rt.enviar('cancelamento',loteCancelamento(pedido))
   await finalizarEvento(r,autor,pedido,resposta)
  }catch{
   await rt.db.nfeRealCancelamento.updateMany({where:{reservaId:r.id,status:'enviando',xmlPedido:pedido},data:{status:'incerta',motivo:'Consulte a chave para confirmar o cancelamento.'}})
  }
  return resumoReal(await rt.db.nfeRealReserva.findUniqueOrThrow({where:{id:r.id}}))
 }
 async function reenviarCancelamento(vendaId:string,autor:string){
  const r=await rt.db.nfeRealReserva.findUnique({where:{vendaId},include:{cancelamento:true}})
  const e=r?.cancelamento
  exigir(r?.chave&&r.xmlAssinado&&r.status==='autorizada'&&e&&['incerta','enviando'].includes(e.status)&&Date.now()-e.updatedAt.getTime()>=prazoConsulta,
   'Aguarde três minutos e consulte o cancelamento antes de reenviar.')
  const consulta=consultaReal(r.chave,null),resposta=await rt.enviar(consulta.operacao,consulta.xml)
  if(retornoCancelamento(resposta,r.chave,e.xmlPedido,true)){
   await finalizarEvento(r,autor,e.xmlPedido,resposta,true)
   return resumoReal(await rt.db.nfeRealReserva.findUniqueOrThrow({where:{vendaId}}))
  }
  exigir(interpretarRetornoReal(resposta,'consulta',r.chave,r.xmlAssinado,null).status==='autorizada','Falta confirmar a autorização e a ausência do evento.')
  await transacao(async tx=>{
   await travarVenda(tx,vendaId)
   const claimed=await tx.nfeRealCancelamento.updateMany({where:{reservaId:r.id,status:e.status,updatedAt:e.updatedAt,xmlPedido:e.xmlPedido},data:{status:'enviando',updatedAt:new Date()}})
   exigir(claimed.count===1,'Cancelamento atualizado durante a consulta.')
   await registro(tx,r,'reenviar_mesmo_cancelamento',autor,resposta)
  })
  return transmitirEvento(r,e.xmlPedido,autor)
 }
 async function inutilizar(vendaId:string,autor:string,justificativa:string){
  const agora=rt.agora?.()??new Date()
  exigir(inutilizacaoDisponivel(agora),'A janela de transição da inutilização em SP está encerrada.')
  const {r,pedido}=await transacao(async tx=>{
   await travarVenda(tx,vendaId)
   const r=await tx.nfeRealReserva.findUnique({where:{vendaId},include:{inutilizacao:true}})
   exigir(r?.chave&&r.status==='quebra','A inutilização exige quebra de sequência já registrada para esta venda.')
   const nota=await notaPropria(tx,vendaId)
   exigir(nota.status==='quebra'&&!nota.protocolo&&!nota.xmlAutorizado,'Número vinculado a autorização ou protocolo.')
   const e=r.inutilizacao
   if(e&&['enviando','incerta'].includes(e.status)){
    exigir(Date.now()-e.updatedAt.getTime()>=prazoConsulta,'Aguarde a conclusão da tentativa anterior.')
   }
   const pedido=e&&e.status!=='rejeitada'?e.xmlPedido:pedidoInutilizacao(r.chave,justificativa,rt.chaves(r.cnpj),agora)
   await tx.nfeRealInutilizacao.upsert({where:{reservaId:r.id},create:{reservaId:r.id,xmlPedido:pedido,status:'enviando'},update:{xmlPedido:pedido,status:'enviando',updatedAt:new Date()}})
   await registro(tx,r,'solicitar_inutilizacao',autor,pedido)
   return {r,pedido}
  })
  try{
   const resposta=await rt.enviar('inutilizacao',pedido),resultado=retornoInutilizacao(resposta,pedido)
   await transacao(async tx=>{
    await travarVenda(tx,vendaId)
    const mudou=await tx.nfeRealInutilizacao.updateMany({where:{reservaId:r.id,xmlPedido:pedido,status:{in:['enviando','incerta']}},data:resultado})
    if(!mudou.count)return
    if(resultado.status==='aceita'){
     await tx.nfeRealReserva.update({where:{id:r.id},data:{status:'inutilizada',motivo:resultado.motivo,revisao:{increment:1}}})
     await tx.notaFiscal.update({where:{vendaId},data:{status:'inutilizada'}})
    }
    await registro(tx,r,'retorno_inutilizacao',autor,resposta)
   })
  }catch{
   await rt.db.nfeRealInutilizacao.updateMany({where:{reservaId:r.id,xmlPedido:pedido,status:'enviando'},data:{status:'incerta',motivo:'Confirme o protocolo da faixa na SEFAZ-SP.'}})
  }
  return resumoReal(await rt.db.nfeRealReserva.findUniqueOrThrow({where:{vendaId}}))
 }
 async function registrarQuebra(vendaId:string,autor:string,motivo:string){
  return transacao(async tx=>{
   await travarVenda(tx,vendaId)
   const r=await tx.nfeRealReserva.findUnique({where:{vendaId}})
   exigir(r&&(r.status==='rejeitada'||r.status==='preparada'&&!r.enviadaEm),'Só é possível registrar um número comprovadamente sem autorização.')
   await registro(tx,r,'quebra_de_sequencia_sp',autor,motivo)
   await tx.notaFiscal.update({where:{vendaId},data:{status:'quebra',erro:motivo}})
   return resumoReal(await tx.nfeRealReserva.update({where:{vendaId},data:{status:'quebra',motivo,revisao:{increment:1}}}))
  })
 }
 return {conferirPedidoAmazon,preparar,enviar,consultar,cancelar,reenviarCancelamento,registrarQuebra,inutilizar}
}
