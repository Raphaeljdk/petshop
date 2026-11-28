'use client'
import {useEffect,useState} from 'react'
import {Button} from '@/components/ui/button'
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog'
import {ComandaAtendimento} from '@/components/atendimentos/ComandaAtendimento'
import {AtendimentoFichaDialog} from '@/components/atendimentos/AtendimentoFichaDialog'
import {portalRequest} from '@/components/cliente-portal/ExperienceProvider'
import type {Processo} from '@/lib/types'
import type {AgendaCalendarEntry} from './AgendaCalendar'
type Ref={id:string;servico:string;status:string;createdAt:string;valorServico:number}
type Data={processo:Ref|null;candidatos:Ref[];encerrado:boolean}
export function AgendaComandaDialog({item,onClose}:{item:AgendaCalendarEntry;onClose:()=>void}){
 const [dados,setDados]=useState<Data|null>(null)
 const [erro,setErro]=useState('')
 const [busy,setBusy]=useState(false)
 const [selecionado,setSelecionado]=useState('')
 const [ficha,setFicha]=useState<Processo|null>(null)
 const url='/api/agendamentos/'+encodeURIComponent(item.id)+'/comanda'
 useEffect(()=>{let ativo=true;portalRequest<Data>(url).then(r=>{if(ativo)setDados(r)}).catch(e=>{if(ativo)setErro(e.message)});return()=>{ativo=false}},[url])
 async function abrir(){
  if(busy||!dados)return
  if(!window.confirm(selecionado?'Vincular este atendimento à agenda?':'Criar o atendimento deste agendamento e iniciar sua ficha?'))return
  setBusy(true);setErro('')
  try{const r=await portalRequest<{processo:Ref}>(url,{method:'POST',body:JSON.stringify(selecionado?{processoId:selecionado}:{})});setDados({...dados,processo:r.processo})}
  catch(e){setErro(e instanceof Error?e.message:'Não foi possível abrir.')}
  finally{setBusy(false)}
 }
 async function abrirFicha(){
  if(!dados?.processo)return
  try{setFicha(await portalRequest<Processo>('/api/processos/'+encodeURIComponent(dados.processo.id)))}
  catch(e){setErro(e instanceof Error?e.message:'Falha ao consultar ficha.')}
 }
 return <>
 <Dialog open={!ficha} onOpenChange={v=>{if(!v&&!ficha)onClose()}}>
  <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
   <DialogHeader><DialogTitle>Atendimento de {item.pet.nome}</DialogTitle><DialogDescription>{item.cliente.nome} · {item.servico}</DialogDescription></DialogHeader>
   {erro&&<p role="alert" className="text-sm text-destructive">{erro}</p>}
   {!dados&&!erro&&<p className="text-sm text-muted-foreground">Consultando atendimento...</p>}
   {dados?.processo?<><Button variant="outline" onClick={()=>void abrirFicha()}>Abrir anamnese e check-out</Button><ComandaAtendimento processoId={dados.processo.id} equipe/></>:dados&&<div className="space-y-3">
    {dados.encerrado?<p className="text-sm">Agendamento encerrado sem atendimento vinculado.</p>:<>
    {dados.candidatos.length>0?<><p className="text-sm">Já existem atendimentos ativos para este pet. Selecione o registro correto, sem criar uma segunda comanda.</p><select aria-label="Atendimento existente" className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={selecionado} onChange={e=>setSelecionado(e.target.value)}><option value="">Selecione o atendimento</option>{dados.candidatos.map(p=><option key={p.id} value={p.id}>{p.servico} · {new Date(p.createdAt).toLocaleString('pt-BR')} · {p.status}</option>)}</select></>:<p className="text-sm">Crie um atendimento vinculado a este agendamento. O preço será consultado pelo porte e raça do pet.</p>}
    <Button disabled={busy||(dados.candidatos.length>0&&!selecionado)} onClick={()=>void abrir()}>{selecionado?'Vincular atendimento':'Abrir atendimento e comanda'}</Button></>}
   </div>}
  </DialogContent>
 </Dialog>
 {ficha&&<AtendimentoFichaDialog processo={ficha} onClose={()=>setFicha(null)}/>}
 </>
}
