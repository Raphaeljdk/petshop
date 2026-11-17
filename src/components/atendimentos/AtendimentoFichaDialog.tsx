'use client'
import {useEffect,useState} from 'react'
import {toast} from 'sonner'
import {Printer,Send,ShieldCheck} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog'
import {CHECKIN_SECTIONS,CHECKOUT_SECTIONS,ACEITE_TEXTO,ACEITE_VERSAO,type FormAnswers} from '@/lib/atendimento-ficha'
import {FichaSections,asAnswers,dateTime} from './FichaSections'
import type {Processo} from '@/lib/types'

type Ficha={id:string;checkin:unknown;checkinStatus:string;checkinSubmittedAt:string|null;
 tutorAceiteAt:string|null;tutorAceiteNome:string|null;tutorAceiteVersao:string|null;tutorAceiteHash:string|null;
 checkout:unknown;checkoutFinalizadoAt:string|null;eventos:Array<{id:string;acao:string;createdAt:string;resumo:string|null}>}
type Entry={processo:{id:string;servico:string;pet:{nome:string;raca:string|null;especie:string;
 cliente:{nome:string;telefone:string}}};ficha:Ficha|null}
const label:Record<string,string>={rascunho:'Rascunho interno',pendente_aceite:'Aguardando aceite do tutor',
 aceito:'Aceite registrado',recusado:'Tutor não autorizou'}
export function AtendimentoFichaDialog({processo,onClose}:{processo:Processo|null;onClose:()=>void}){
 const [loading,setLoading]=useState(false)
 const [data,setData]=useState<Entry|null>(null)
 const [checkin,setCheckin]=useState<FormAnswers>({})
 const [checkout,setCheckout]=useState<FormAnswers>({})
 const [view,setView]=useState<'checkin'|'checkout'>('checkin')
 const [busy,setBusy]=useState(false)
 const [edited,setEdited]=useState(false)
 const id=processo?.id
 async function reload(id:string){
  const res=await fetch('/api/processos/'+encodeURIComponent(id)+'/ficha',{credentials:'same-origin',cache:'no-store'})
  const body=await res.json().catch(()=>null)
  if(!res.ok)throw Error(body?.error||'Falha ao buscar ficha.')
  setData(body);setCheckin(asAnswers(body.ficha?.checkin));setCheckout(asAnswers(body.ficha?.checkout));setEdited(false)
 }
 useEffect(()=>{
  if(!id){setData(null);return}
  let active=true
  setLoading(true);setView('checkin')
  fetch('/api/processos/'+encodeURIComponent(id)+'/ficha',{credentials:'same-origin',cache:'no-store'})
   .then(async res=>{const b=await res.json();if(!res.ok)throw Error(b.error||'Falha.');return b})
   .then(b=>{if(active){setData(b);setCheckin(asAnswers(b.ficha?.checkin));setCheckout(asAnswers(b.ficha?.checkout));setEdited(false)}})
   .catch(e=>{if(active)toast.error(e instanceof Error?e.message:'Erro ao abrir ficha.')})
   .finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 },[id])
 async function save(action:'salvar_checkin'|'enviar_checkin'|'salvar_checkout'|'finalizar_checkout'){
  if(!id||busy)return
  if(action==='enviar_checkin'&&!window.confirm('Enviar o check-in ao tutor? O documento ficará bloqueado para preservar o aceite.'))return
  if(action==='finalizar_checkout'&&!window.confirm('Finalizar e registrar o check-out no histórico do pet?'))return
  setBusy(true)
  try{
   const r=await fetch('/api/processos/'+encodeURIComponent(id)+'/ficha',{
    method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,answers:action.endsWith('checkin')?checkin:checkout}),
   })
   const payload=await r.json().catch(()=>null)
   if(!r.ok)throw Error(payload?.error||'Falha ao salvar.')
   await reload(id)
   toast.success(action==='enviar_checkin'?'Check-in enviado para aceite no portal do tutor.':
    action==='finalizar_checkout'?'Check-out finalizado.':'Rascunho salvo.')
  }catch(e){toast.error(e instanceof Error?e.message:'Falha ao salvar.')}
  finally{setBusy(false)}
 }
 const f=data?.ficha
 const canCheckin=!f||f.checkinStatus==='rascunho'
 const canCheckout=f?.checkinStatus==='aceito'&&!f.checkoutFinalizadoAt
 return <>
 <Dialog open={!!processo} onOpenChange={o=>{if(!o)onClose()}}>
  <DialogContent className="max-w-[96vw] sm:max-w-3xl max-h-[94vh] overflow-y-auto">
   <DialogHeader><DialogTitle>Fichas do atendimento — {data?.processo.pet.nome||processo?.pet?.nome}</DialogTitle>
    <DialogDescription>Check-in, aceite do tutor, check-out e impressão. Histórico privado.</DialogDescription></DialogHeader>
   {loading?<p>Carregando fichas...</p>:!data?<p>Ficha não disponível. Reabra o atendimento.</p>:<>
    <div className="flex flex-wrap justify-between gap-2 rounded-md border p-2 text-xs">
     <span><b>{data.processo.servico}</b> · {data.processo.pet.cliente.nome}</span>
     <Badge variant="outline">{label[f?.checkinStatus||'rascunho']}</Badge>
    </div>
    <div className="flex flex-wrap gap-2">
     <Button size="sm" variant={view==='checkin'?'default':'outline'} onClick={()=>setView('checkin')}>Check-in / anamnese</Button>
     <Button size="sm" variant={view==='checkout'?'default':'outline'} onClick={()=>setView('checkout')}>Check-out</Button>
     <Button size="sm" variant="outline" onClick={()=>{if(edited&&!window.confirm('A impressão não salva as alterações atuais. Continuar?'))return;window.print()}}>
      <Printer className="mr-1 size-4"/> Imprimir fichas completas
     </Button>
    </div>
    {view==='checkin'?<>
     <p className="text-xs">1. Identificação · Pet: {data.processo.pet.nome} · {data.processo.pet.raca||data.processo.pet.especie} · Tutor: {data.processo.pet.cliente.nome} · {data.processo.pet.cliente.telefone}</p>
     <FichaSections sections={CHECKIN_SECTIONS} answers={checkin} onChange={canCheckin?v=>{setCheckin(v);setEdited(true)}:undefined} initialOpen/>
     <div className="rounded-lg border p-3 text-xs">
      <b>10. Ciência e autorização do tutor</b><p className="my-2">{ACEITE_TEXTO}</p>
      <p>{f?.tutorAceiteAt?(f.checkinStatus==='aceito'?'Aceite':'Recusa')+' de '+(f.tutorAceiteNome||'tutor')+' em '+dateTime(f.tutorAceiteAt):
      f?.checkinStatus==='pendente_aceite'?'Aguardando resposta no portal Meus Pets.':'Ainda não enviado para aceite.'}</p>
     </div>
     {canCheckin&&<div className="flex justify-end flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={()=>void save('salvar_checkin')}>Salvar rascunho</Button>
      <Button disabled={busy} onClick={()=>void save('enviar_checkin')}><Send className="mr-1 size-4"/> Enviar para aceite</Button>
     </div>}
    </>:<>
     {f?.checkinStatus!=='aceito'&&<p className="rounded-md border p-3 text-xs text-amber-800">O check-out depende do aceite do tutor no portal. Situação: {label[f?.checkinStatus||'rascunho']}.</p>}
     <FichaSections sections={CHECKOUT_SECTIONS} answers={checkout} onChange={canCheckout?v=>{setCheckout(v);setEdited(true)}:undefined} initialOpen/>
     {canCheckout&&<div className="flex justify-end flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={()=>void save('salvar_checkout')}>Salvar rascunho</Button>
      <Button disabled={busy} onClick={()=>void save('finalizar_checkout')}>Finalizar check-out</Button>
     </div>}
     {f?.checkoutFinalizadoAt&&<p className="text-xs text-green-700"><ShieldCheck className="inline mr-1 size-4"/> Finalizado em {dateTime(f.checkoutFinalizadoAt)}. Registro imutável.</p>}
    </>}
    {Boolean(f?.eventos?.length)&&<details className="rounded-lg border p-2 text-xs">
     <summary className="cursor-pointer">Histórico de registros e aceite</summary>
     {f?.eventos.map(ev=><p key={ev.id} className="mt-1">{dateTime(ev.createdAt)} · {ev.acao.replaceAll('_',' ')} · {ev.resumo}</p>)}
    </details>}
   </>}
  </DialogContent>
 </Dialog>
 {processo&&data&&<div id="matilha-fichas-print" aria-hidden="true" className="hidden">
  <h1 className="text-xl font-bold">MATILHA PRADO — FICHAS DO ATENDIMENTO</h1>
  <p>Pet: {data.processo.pet.nome} · Raça: {data.processo.pet.raca||'Não informada'} · Tutor: {data.processo.pet.cliente.nome}</p>
  <p>Telefone: {data.processo.pet.cliente.telefone} · Serviço: {data.processo.servico}</p>
  <h2 className="mt-3 text-lg font-bold">FICHA DE ANAMNESE E CHECK-IN PET</h2>
  <p>Enviado: {dateTime(f?.checkinSubmittedAt)} · Status: {label[f?.checkinStatus||'rascunho']}</p>
  <FichaSections sections={CHECKIN_SECTIONS} answers={checkin} readonly/>
  <h3 className="mt-4 font-bold">10. Ciência e autorização do tutor</h3><p className="text-xs">{ACEITE_TEXTO}</p>
  <p className="mt-2 text-xs">Resposta: {f?.checkinStatus==='aceito'?'ACEITO':f?.checkinStatus==='recusado'?'NÃO AUTORIZADO':'SEM ACEITE'} · Nome: {f?.tutorAceiteNome||'—'} · Data: {dateTime(f?.tutorAceiteAt)}</p>
  <p className="text-[10px]">Versão: {f?.tutorAceiteVersao||ACEITE_VERSAO} · Hash da ficha: {f?.tutorAceiteHash||'Não registrado'}</p>
  <h2 className="mt-6 text-lg font-bold" style={{breakBefore:'page'}}>FICHA DE CHECK-OUT PET</h2>
  <p>Finalização: {dateTime(f?.checkoutFinalizadoAt)}</p>
  <FichaSections sections={CHECKOUT_SECTIONS} answers={checkout} readonly/>
  <p className="mt-6 text-xs">Matilha Prado — Cuidado, respeito e bem-estar em cada detalhe. Avaliação visual, sem diagnóstico veterinário.</p>
 </div>}
 <style jsx global>{'@media print { @page { margin: 13mm; size: A4; } body * { visibility: hidden !important; } #matilha-fichas-print, #matilha-fichas-print * { visibility: visible !important; } #matilha-fichas-print { display: block !important; position: absolute !important; z-index: 999999; top: 0; left: 0; width: 100% !important; background: white !important; color: black !important; } #matilha-fichas-print details { display: block !important; break-inside: avoid-page; } #matilha-fichas-print .text-muted-foreground { color: black !important; } }'}</style>
 </>
}
