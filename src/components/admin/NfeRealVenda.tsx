'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Operacao={status:string;numero:number;chave:string;codigo:number|null;motivo:string|null;podeReenviar:boolean}
type Dados={habilitado:boolean;transicao:boolean;inutilizacao:{status:string;motivo:string|null}|null;reserva:Operacao|null;evento:{status:string;motivo:string|null}|null;endereco:string|null;cep:string|null}
export function NfeRealVenda({vendaId,onChange}:{vendaId:string;onChange:()=>void}){
 const [aberto,setAberto]=useState(false),[dados,setDados]=useState<Dados|null>(null),[ocupado,setOcupado]=useState(false),[erro,setErro]=useState('')
 const [pag,setPag]=useState(''),[integra,setIntegra]=useState('')
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
  setOcupado(true);setErro('')
  try{
   const res=await fetch('/api/admin/fiscal/real',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vendaId,acao,...extra})})
   const json=await res.json()
   if(!res.ok)throw Error(json.error)
   await ler();onChange()
  }catch(e){setErro((e as Error).message)}finally{setOcupado(false)}
 }
 const r=dados?.reserva
 return <div className="w-full">
  <Button type="button" variant="outline" size="sm" aria-expanded={aberto} onClick={()=>void abrir()}>NF-e própria · série 2</Button>
  {aberto&&<section className="mt-2 space-y-2 rounded border p-3 text-sm">
   {erro&&<p role="alert">{erro}</p>}
   {dados&&!dados.habilitado&&<p>Emissão real bloqueada. A liberação exige a conciliação da série e regras aprovadas para produção.</p>}
   {r&&<p>Série 2 nº {r.numero} · {r.status} {r.codigo&&' · cStat '+r.codigo} {r.motivo&&' · '+r.motivo}</p>}
   {dados?.evento&&<p>Cancelamento {dados.evento.status} · {dados.evento.motivo}</p>}
   {dados?.habilitado&&(!r||r.status==='rejeitada'||r.status==='preparada')&&<form className="space-y-2" onSubmit={e=>{
    e.preventDefault()
    const form=new FormData(e.currentTarget),get=(k:string)=>String(form.get(k)||'').trim()
    void agir(r?'corrigir':'preparar',{dados:{endereco:{logradouro:get('logradouro'),numero:get('numero'),complemento:get('complemento'),bairro:get('bairro'),municipio:get('municipio'),codigoMunicipio:get('codigoMunicipio'),cep:get('cep'),uf:'SP'},
     pagamento:pag,modalidadeFrete:get('frete'),consumidorFinalNaoContribuinte:true,semNotaExterna:true,
     ...(pag==='17'?{dadosPagamento:{tipoIntegracao:integra,...(integra==='1'?{cnpjInstituicao:get('cnpjInstituicao'),codigoAutorizacao:get('codigoAutorizacao')}:{})}}:{})}})
   }}>
    <p>Endereço registrado no pedido · {dados.endereco||'sem endereço'}</p>
    <div className="grid gap-2 sm:grid-cols-3">
    {Object.entries({logradouro:'Logradouro',numero:'Número',complemento:'Complemento',bairro:'Bairro',municipio:'Município (SP)',codigoMunicipio:'Código IBGE do município',cep:'CEP'}).map(([k,v])=><label key={k}>{v}<Input name={k} required={k!=='complemento'} defaultValue={k==='cep'?dados.cep?.replace(/\D/g,''):undefined}/></label>)}
    <label>Pagamento<select required value={pag} onChange={e=>setPag(e.target.value)}><option value="">Selecione</option><option value="01">Dinheiro</option><option value="17">Pix dinâmico</option><option value="18">Transferência bancária</option><option value="20">Pix estático</option></select></label>
    {pag==='17'&&<label>Integração Pix<select required value={integra} onChange={e=>setIntegra(e.target.value)}><option value="">Selecione</option><option value="1">Integrado</option><option value="2">Não integrado</option></select></label>}
    {pag==='17'&&integra==='1'&&<><label>CNPJ da instituição<Input name="cnpjInstituicao" required/></label><label>Autorização do pagamento<Input name="codigoAutorizacao" required/></label></>}
    <label>Frete<select name="frete" defaultValue="" required><option value="">Selecione</option><option value="0">Por conta do remetente</option><option value="1">Por conta do destinatário</option><option value="2">Por conta de terceiros</option><option value="9">Sem transporte</option></select></label></div>
    <label className="block"><input type="checkbox" required/> Conferi a venda, o pagamento e o endereço. É uma venda interna a consumidor final não contribuinte, sem nota de outro emissor.</label>
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
