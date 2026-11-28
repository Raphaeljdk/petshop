'use client'
import { useState } from 'react'
import { PREFIXO_IBGE_UF } from '@/lib/nfe-destino'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Operacao={status:string;numero:number;chave:string;codigo:number|null;motivo:string|null;podeReenviar:boolean}
type Dados={emailManual:boolean;email:{status:string;sentAt:string|null}|null;externa:{numero:number;status:string}|null;canal:string;habilitado:boolean;transicao:boolean;inutilizacao:{status:string;motivo:string|null}|null;reserva:Operacao|null;evento:{status:string;motivo:string|null}|null;endereco:string|null;cep:string|null}
export function NfeRealVenda({vendaId,onChange}:{vendaId:string;onChange:()=>void}){
 const [aberto,setAberto]=useState(false),[dados,setDados]=useState<Dados|null>(null),[ocupado,setOcupado]=useState(false),[erro,setErro]=useState('')
 const [pag,setPag]=useState(''),[integra,setIntegra]=useState('')
 const [pedidoConferido,setPedidoConferido]=useState('')
 const url='/api/admin/fiscal/real?vendaId='+encodeURIComponent(vendaId)
 async function ler(){
  const res=await fetch(url,{cache:'no-store'}),json=await res.json()
  if(!res.ok)throw Error(json.error)
  setDados(json)
 }
 async function abrir(){
  setAberto(!aberto)
  if(!aberto){setErro('');try{await ler()}catch(e){setErro((e as Error).message)}}
 }
 async function agir(acao:string,extra:Record<string,unknown>={}){
  setOcupado(true);setErro('');setPedidoConferido('')
  try{
   const res=await fetch('/api/admin/fiscal/real',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vendaId,acao,...extra})})
   const json=await res.json()
   if(!res.ok)throw Error(json.error)
   if(acao==='conferir_amazon'){setPedidoConferido(json.pedido);return}
   await ler();onChange()
  }catch(e){setErro((e as Error).message)}finally{setOcupado(false)}
 }
 async function importarExterna(file:File){
  if(file.size>500000){setErro('XML muito grande.');return}
  if(!confirm('Confirma que o XML pertence exatamente a esta venda? A SEFAZ será consultada.'))return
  setOcupado(true);setErro('')
  try{
   const res=await fetch('/api/admin/fiscal/externa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vendaId,xml:await file.text(),confirmacao:'VINCULAR NOTA EXTERNA AO PEDIDO'})})
   const json=await res.json();if(!res.ok)throw Error(json.error)
   await ler();onChange()
  }catch(e){setErro((e as Error).message)}finally{setOcupado(false)}
 }
 const r=dados?.reserva
 return <div className="w-full">
  <Button type="button" variant="outline" size="sm" aria-expanded={aberto} onClick={()=>void abrir()}>NF-e própria · série 2</Button>
  {aberto&&<section className="mt-2 space-y-2 rounded border p-3 text-sm">
   {erro&&<p role="alert">{erro}</p>}
   {dados&&!dados.habilitado&&<p>Emissão real bloqueada. A liberação exige a conciliação da série e regras aprovadas para produção.</p>}
   {dados?.externa&&<div><p>NF-e externa autorizada · série 2 nº {dados.externa.numero}</p><div className="flex gap-3"><a href={'/api/admin/fiscal/externa?vendaId='+encodeURIComponent(vendaId)+'&arquivo=xml'}>Baixar XML</a><a href={'/api/admin/fiscal/externa?vendaId='+encodeURIComponent(vendaId)+'&arquivo=pdf'}>Baixar DANFE</a></div></div>}
   {dados&&!dados.externa&&!r&&['site','amazon'].includes(dados.canal)&&<label className="block">Importar XML autorizado do Sebrae<Input type="file" accept=".xml,text/xml,application/xml" disabled={ocupado} onChange={e=>{const file=e.target.files?.[0];if(file)void importarExterna(file);e.target.value=''}}/></label>}
   {dados?.canal==='amazon'&&!dados.externa&&!r&&<Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={()=>void agir('conferir_amazon')}>Conferir pedido na Amazon</Button>}
   {pedidoConferido&&<p role="status">Pedido {pedidoConferido} conferido. A Amazon indica envio pelo vendedor, aguardando expedição e sem NF-e carregada. Os dados do comprador estão disponíveis para a nota.</p>}
   {r&&<p>Série 2 nº {r.numero} · {r.status} {r.codigo&&' · cStat '+r.codigo} {r.motivo&&' · '+r.motivo}</p>}
   {dados?.evento&&<p>Cancelamento {dados.evento.status} · {dados.evento.motivo}</p>}
   {dados?.habilitado&&!dados.externa&&(!r||r.status==='rejeitada'||r.status==='preparada')&&<form className="space-y-2" onSubmit={e=>{
    e.preventDefault()
    const form=new FormData(e.currentTarget),get=(k:string)=>String(form.get(k)||'').trim()
    void agir(r?'corrigir':'preparar',{dados:{endereco:{logradouro:get('logradouro'),numero:get('numero'),complemento:get('complemento'),bairro:get('bairro'),municipio:get('municipio'),codigoMunicipio:get('codigoMunicipio'),cep:get('cep'),uf:get('uf')},
     pagamento:pag,modalidadeFrete:get('frete'),consumidorFinalNaoContribuinte:true,semNotaExterna:true,
     ...(['03','04'].includes(pag)?{dadosPagamento:{tipoIntegracao:'2'}}:pag==='17'?{dadosPagamento:{tipoIntegracao:integra,...(integra==='1'?{cnpjInstituicao:get('cnpjInstituicao'),codigoAutorizacao:get('codigoAutorizacao')}:{})}}:{})}})
   }}>
    <p>Endereço registrado no pedido · {dados.endereco||'sem endereço'}</p>
    <div className="grid gap-2 sm:grid-cols-3">
    {Object.entries({logradouro:'Logradouro',numero:'Número',complemento:'Complemento',bairro:'Bairro',municipio:'Município',codigoMunicipio:'Código IBGE do município',cep:'CEP'}).map(([k,v])=><label key={k}>{v}<Input name={k} required={k!=='complemento'} defaultValue={k==='cep'?dados.cep?.replace(/\D/g,''):undefined}/></label>)}
    <label>UF de destino<select name="uf" defaultValue="" required><option value="">Selecione</option>{Object.keys(PREFIXO_IBGE_UF).sort().map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></label>
    <label>Pagamento<select required value={pag} onChange={e=>setPag(e.target.value)}><option value="">Selecione</option><option value="01">Dinheiro</option>{dados.canal==='amazon'&&<><option value="03">Cartão de crédito (não integrado)</option><option value="04">Cartão de débito (não integrado)</option><option value="99">Pagamento via marketplace (não informado)</option></>}<option value="15">Boleto</option><option value="17">Pix dinâmico</option><option value="18">Transferência bancária</option><option value="20">Pix estático</option></select></label>
    {pag==='17'&&<label>Integração Pix<select required value={integra} onChange={e=>setIntegra(e.target.value)}><option value="">Selecione</option><option value="1">Integrado</option><option value="2">Não integrado</option></select></label>}
    {pag==='17'&&integra==='1'&&<><label>CNPJ da instituição<Input name="cnpjInstituicao" required/></label><label>Autorização do pagamento<Input name="codigoAutorizacao" required/></label></>}
    <label>Frete<select name="frete" defaultValue="" required><option value="">Selecione</option><option value="0">Por conta do remetente</option><option value="1">Por conta do destinatário</option><option value="2">Por conta de terceiros</option><option value="9">Sem transporte</option></select></label></div>
    <label className="block"><input type="checkbox" required/> Conferi a venda, o pagamento e o endereço. É uma venda a consumidor final não contribuinte, sem nota de outro emissor.</label>
    <Button disabled={ocupado} size="sm">{r?'Corrigir com o mesmo número':'Reservar número e assinar'}</Button>
   </form>}
   {r?.status==='preparada'&&dados?.habilitado&&<Button disabled={ocupado} size="sm" onClick={()=>{if(confirm('Transmitir a NF-e real desta venda à SEFAZ-SP?'))void agir('transmitir',{confirmacao:'EMITIR VENDA SELECIONADA'})}}>Transmitir NF-e real</Button>}
   {(r&&['incerta','recebida','enviando'].includes(r.status)||dados?.evento&&['incerta','enviando'].includes(dados.evento.status))&&<Button size="sm" disabled={ocupado} onClick={()=>void agir('consultar')}>Consultar na SEFAZ</Button>}
   {dados?.evento&&['incerta','enviando'].includes(dados.evento.status)&&<Button size="sm" disabled={ocupado} onClick={()=>{if(confirm('Confirma que a mercadoria não circulou? O sistema consultará a chave antes de reenviar o mesmo evento.'))void agir('reenviar_cancelamento',{semCirculacao:true})}}>Conferir e reenviar cancelamento</Button>}
   {r?.podeReenviar&&dados?.habilitado&&<Button size="sm" disabled={ocupado} onClick={()=>{if(confirm('Reenviar o mesmo XML assinado desta venda?'))void agir('retransmitir',{confirmacao:'REENVIAR MESMO XML'})}}>Retransmitir o mesmo XML</Button>}
   {dados?.inutilizacao&&<p>Inutilização {dados.inutilizacao.status} · {dados.inutilizacao.motivo}</p>}
   {r?.status==='inutilizada'&&<a href={url+'&arquivo=inutilizacao'}>Baixar protocolo de inutilização</a>}
   {dados?.transicao&&r?.status==='quebra'&&<details><summary>Solicitar inutilização durante a transição de SP</summary>
    <form onSubmit={e=>{e.preventDefault();const justificativa=String(new FormData(e.currentTarget).get('motivo')||'')
     if(confirm('Transmitir o pedido de inutilização para este número da série 2?'))void agir('inutilizar',{justificativa,confirmacao:'INUTILIZAR NUMERO DESTA VENDA'})}}>
     <label>Justificativa operacional<Input name="motivo" minLength={15} maxLength={255} required/></label>
     <Button size="sm" disabled={ocupado}>Solicitar protocolo de inutilização</Button>
    </form></details>}
   {r?.status==='autorizada'&&<div className="space-y-1">
    <p>E-mail fiscal: {dados?.email?.status||'não enfileirado'}</p>
    {dados?.emailManual&&(!dados.email||['pendente','tentar_novamente','enviando'].includes(dados.email.status))&&<Button type="button" size="sm" disabled={ocupado} onClick={()=>{if(confirm('Enviar somente o XML e DANFE desta venda para o e-mail confirmado do comprador?'))void agir('enviar_email',{confirmacao:'ENVIAR NF-E AO COMPRADOR'})}}>Enviar NF-e por e-mail</Button>}
    {!dados?.emailManual&&<p>Envio manual ainda desativado neste ambiente.</p>}
   </div>}
   {r&&['autorizada','cancelada'].includes(r.status)&&<div className="flex gap-3"><a href={url+'&arquivo=xml'}>Baixar XML</a><a href={url+'&arquivo=pdf'}>Baixar DANFE</a>{r.status==='cancelada'&&<a href={url+'&arquivo=evento'}>XML do cancelamento</a>}</div>}
   {r&&(r.status==='autorizada'&&(!dados?.evento||dados.evento.status==='rejeitada')||['rejeitada','preparada'].includes(r.status))&&<details><summary>{r.status==='autorizada'?'Cancelar NF-e':'Registrar quebra de sequência'}</summary>
    <form className="mt-2 space-y-2" onSubmit={e=>{e.preventDefault();const justificativa=String(new FormData(e.currentTarget).get('motivo')||'')
     if(r.status==='autorizada')void agir('cancelar',{justificativa,semCirculacao:true})
     else void agir('quebra',{justificativa})}}>
     <label>Justificativa<Input name="motivo" minLength={15} maxLength={255} required/></label>
     <label className="block"><input type="checkbox" required/> {r.status==='autorizada'?'Confirmo que não houve circulação da mercadoria e solicito o cancelamento.':'Confirmo o encerramento desta reserva sem reutilizar o número.'}</label>
     <Button size="sm" disabled={ocupado}>Confirmar</Button>
    </form></details>}
  </section>}
 </div>
}
