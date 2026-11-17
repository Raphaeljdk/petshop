'use client'
import {useState} from 'react'
import {toast} from 'sonner'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Checkbox} from '@/components/ui/checkbox'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog'
import {CHECKIN_SECTIONS,CHECKOUT_SECTIONS,ACEITE_TEXTO,ACEITE_VERSAO} from '@/lib/atendimento-ficha'
import {FichaSections,asAnswers,dateTime} from '@/components/atendimentos/FichaSections'

export type ClientFicha={
 id:string;petId:string;processoId:string;checkin:unknown;checkinStatus:string;
 checkinSubmittedAt:string|null;tutorAceiteAt:string|null;tutorAceiteNome:string|null;
 checkout:unknown;checkoutFinalizadoAt:string|null;createdAt:string;
 processo:{servico:string;createdAt:string;pet:{id:string;nome:string;raca:string|null}}
}
const labels:Record<string,string>={rascunho:'Rascunho interno',pendente_aceite:'Aguardando seu aceite',
 aceito:'Autorizado',recusado:'Não autorizado'}
export function ClientFichasPet({petNome,fichas,onUpdated}:{petNome:string;fichas:ClientFicha[];onUpdated:()=>Promise<void>}){
 const [selected,setSelected]=useState<ClientFicha|null>(null)
 const [name,setName]=useState('')
 const [checked,setChecked]=useState(false)
 const [busy,setBusy]=useState(false)
 const visible=fichas.filter(f=>f.checkinSubmittedAt)
 if(!visible.length)return null
 const pending=visible.filter(f=>f.checkinStatus==='pendente_aceite')
 async function answer(action:'aceitar'|'recusar'){
  if(!selected||busy)return
  if(action==='recusar'&&!window.confirm('Confirmar que você NÃO autoriza o serviço? A equipe deverá tratar o atendimento antes de prosseguir.'))return
  setBusy(true)
  try{
   const r=await fetch('/api/cliente/atendimentos/'+encodeURIComponent(selected.id)+'/aceite',{
    method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
    body:JSON.stringify({action,confirmed:checked,name,version:ACEITE_VERSAO}),
   })
   const data=await r.json().catch(()=>null)
   if(!r.ok)throw Error(data?.error||'Não foi possível registrar sua resposta.')
   toast.success(action==='aceitar'?'Sua autorização ficou registrada na ficha do pet.':'Sua recusa ficou registrada.')
   setSelected(null);setName('');setChecked(false);await onUpdated()
  }catch(e){toast.error(e instanceof Error?e.message:'Falha ao registrar aceite.')}
  finally{setBusy(false)}
 }
 return <div className="space-y-2 rounded-lg border p-3">
  <p className="text-xs font-semibold">Fichas de atendimento ({visible.length})</p>
  {pending.map(f=><div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">
   <span><strong>Aguardando sua autorização:</strong> {f.processo.servico} · {dateTime(f.checkinSubmittedAt)}</span>
   <Button size="sm" onClick={()=>{setSelected(f);setChecked(false);setName('')}}>Ler ficha e responder</Button>
  </div>)}
  <details className="text-xs">
   <summary className="cursor-pointer text-muted-foreground">Ver histórico de check-in e check-out</summary>
   <div className="mt-2 space-y-2">
    {visible.map(f=><div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
     <span>{dateTime(f.createdAt)} · {f.processo.servico} · <b>{labels[f.checkinStatus]||f.checkinStatus}</b>{f.checkoutFinalizadoAt?' · Check-out concluído':''}</span>
     <Button size="sm" variant="outline" onClick={()=>{setSelected(f);setChecked(false);setName('')}}>Ver ficha</Button>
    </div>)}
   </div>
  </details>
  <Dialog open={!!selected} onOpenChange={o=>{if(!o)setSelected(null)}}>
   <DialogContent className="max-w-[96vw] sm:max-w-3xl max-h-[93vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Ficha do pet {petNome}</DialogTitle>
     <DialogDescription>{selected?.processo.servico} · {dateTime(selected?.createdAt)} · Histórico privado</DialogDescription></DialogHeader>
    {selected&&<>
     <p className="rounded-md border p-2 text-xs"><b>Check-in enviado:</b> {dateTime(selected.checkinSubmittedAt)} · {labels[selected.checkinStatus]}</p>
     <p className="text-xs font-semibold">MATILHA PRADO — Avaliação inicial visual e preventiva</p>
     <FichaSections sections={CHECKIN_SECTIONS} answers={asAnswers(selected.checkin)} readonly/>
     <div className="rounded-lg border p-3 text-sm">
      <p className="font-semibold">10. Ciência e autorização do tutor</p>
      <p className="my-2 text-xs leading-relaxed">{ACEITE_TEXTO}</p>
      {selected.checkinStatus==='pendente_aceite'?<>
       <label className="my-3 flex items-start gap-2 text-xs">
        <Checkbox checked={checked} onCheckedChange={v=>setChecked(v===true)}/>
        Li a avaliação e concordo com o termo acima e com a realização do serviço, respeitando os limites de segurança do meu pet.
       </label>
       <label className="block text-xs font-semibold" htmlFor="ficha-tutor-nome">Nome completo para assinatura eletrônica</label>
       <Input id="ficha-tutor-nome" className="mt-1" maxLength={140} value={name} onChange={e=>setName(e.target.value)} placeholder="Digite seu nome completo"/>
       <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={()=>void answer('recusar')}>Não autorizo</Button>
        <Button disabled={busy||!checked||name.trim().length<3} onClick={()=>void answer('aceitar')}>Li e autorizo o serviço</Button>
       </div>
      </>:<p className="mt-2 text-xs font-medium">{selected.checkinStatus==='aceito'?'Aceite registrado':'Recusa registrada'} · {selected.tutorAceiteNome||'Tutor'} · {dateTime(selected.tutorAceiteAt)}</p>}
     </div>
     {selected.checkoutFinalizadoAt&&<>
      <p className="mt-3 text-sm font-semibold">Ficha de check-out — finalizado em {dateTime(selected.checkoutFinalizadoAt)}</p>
      <FichaSections sections={CHECKOUT_SECTIONS} answers={asAnswers(selected.checkout)} readonly/>
     </>}
     {!selected.checkoutFinalizadoAt&&<p className="rounded-md border p-3 text-xs text-muted-foreground">O check-out ficará disponível no histórico após a equipe finalizar a avaliação de saída.</p>}
    </>}
   </DialogContent>
  </Dialog>
 </div>
}
