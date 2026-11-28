'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, Clock3, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { diaBrasilia, horariosDoDia, LIMITE_AGENDA_DIAS } from '@/lib/agenda-horarios-portal'
import { portalRequest } from './ExperienceProvider'

type Props={petKey:string;servicoChave:string;value:string;onChange:(v:string)=>void;disabled?:boolean;direct?:boolean}

export function AgendaDateTimePicker({petKey,servicoChave,value,onChange,disabled=false,direct=false}:Props){
 const [dia,setDia]=useState(value.slice(0,10))
 const [dataAberta,setDataAberta]=useState(false)
 const [horaAberta,setHoraAberta]=useState(false)
 const [resultado,setResultado]=useState<{dia:string;chave:string;horarios:string[];motivo:string|null}|null>(null)
 const [erro,setErro]=useState('')
 const [tentativa,setTentativa]=useState(0)
 const hoje=diaBrasilia(new Date())
 const limite=diaBrasilia(new Date(Date.now()+LIMITE_AGENDA_DIAS*86400000))
 const selecionada=dia?parseISO(dia):undefined
 const chave=petKey+'|'+servicoChave
 const habilitado=Boolean(petKey&&(servicoChave||direct)&&!disabled)
 const atual=resultado?.dia===dia&&resultado.chave===chave?resultado:null
 const carregando=Boolean(dia&&habilitado&&!atual&&!erro)
 useEffect(()=>{
  let ativo=true
  if(!dia||!habilitado)return
  if(direct){setResultado({dia,chave,horarios:horariosDoDia(dia),motivo:null});return}
  portalRequest<{horarios:string[];motivo:string|null}>('/api/cliente/agendamentos/horarios?'+new URLSearchParams({petKey,dia,servico:servicoChave}))
   .then(r=>{if(ativo)setResultado({dia,chave,horarios:r.horarios,motivo:r.motivo})})
   .catch(()=>{if(ativo)setErro('Não foi possível consultar os horários. Tente novamente.')})
  return()=>{ativo=false}
 },[dia,chave,petKey,servicoChave,habilitado,direct,tentativa])
 const horariosValidos=new Set(horariosDoDia(dia))
 const slots=(atual?.horarios??[]).filter(h=>horariosValidos.has(h))
 const periodos=[{nome:'Manhã',de:6,ate:12},{nome:'Tarde',de:12,ate:18},{nome:'Noite',de:18,ate:24},{nome:'Madrugada',de:0,ate:6}]
 function mudarDia(d?:Date){
  setDia(d?format(d,'yyyy-MM-dd'):'');setResultado(null);setErro('');onChange('');setDataAberta(false)
 }
 return <div className="space-y-2">
  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
   <div className="min-w-0 space-y-1">
    <label htmlFor="request-day" className="text-sm font-medium">Data desejada</label>
    <Popover open={dataAberta} onOpenChange={setDataAberta}>
     <PopoverTrigger asChild><Button id="request-day" type="button" variant="outline" disabled={!habilitado} className="h-11 w-full justify-start rounded-xl px-3 font-normal">
      <CalendarDays className="size-4 shrink-0 text-primary"/><span className="min-w-0 flex-1 truncate text-left">{selecionada?format(selecionada,'dd/MM/yyyy'):'Escolher data'}</span><ChevronDown className="size-4 shrink-0 text-muted-foreground"/>
     </Button></PopoverTrigger>
     <PopoverContent align="start" className="w-[min(20rem,calc(100vw-1.5rem))] max-h-[var(--radix-popover-content-available-height)] overflow-auto rounded-xl p-2">
      <div className="px-2 pt-2 text-sm font-semibold">Escolha o dia</div>
      <Calendar mode="single" locale={ptBR} selected={selecionada} defaultMonth={selecionada??parseISO(hoje)} today={parseISO(hoje)} onSelect={mudarDia} disabled={d=>{const key=format(d,'yyyy-MM-dd');return key<hoje||key>limite}} startMonth={parseISO(hoje)} endMonth={parseISO(limite)} className="mx-auto p-1 [--cell-size:clamp(1.8rem,8vw,2.4rem)]"/>
      <div className="flex justify-between gap-2 border-t p-2"><Button variant="ghost" size="sm" type="button" onClick={()=>mudarDia()}>Limpar</Button><Button variant="outline" size="sm" type="button" onClick={()=>mudarDia(parseISO(hoje))}>Hoje</Button></div>
     </PopoverContent>
    </Popover>
   </div>
   <div className="min-w-0 space-y-1">
    <label htmlFor="request-time" className="text-sm font-medium">Horário desejado</label>
    <Popover open={horaAberta} onOpenChange={setHoraAberta}>
     <PopoverTrigger asChild><Button id="request-time" type="button" variant="outline" disabled={!habilitado||!dia||carregando||!slots.length} className="h-11 w-full justify-start rounded-xl px-3 font-normal">
      {carregando?<Loader2 className="size-4 animate-spin text-primary"/>:<Clock3 className="size-4 shrink-0 text-primary"/>}<span className="min-w-0 flex-1 truncate text-left">{value.slice(11)||'Escolher hora'}</span><ChevronDown className="size-4 shrink-0 text-muted-foreground"/>
     </Button></PopoverTrigger>
     <PopoverContent align="start" className="w-[min(21rem,calc(100vw-1.5rem))] max-h-[min(24rem,var(--radix-popover-content-available-height))] overflow-y-auto rounded-xl p-3">
      <p className="text-sm font-semibold">Horários para solicitar</p><p className="mb-3 text-xs text-muted-foreground">Intervalos de 10 minutos · horário de Brasília</p>
      {periodos.map(p=>{const horas=slots.filter(h=>Number(h.slice(0,2))>=p.de&&Number(h.slice(0,2))<p.ate);return horas.length>0&&<div key={p.nome} className="mb-3"><p className="mb-1.5 text-xs font-semibold text-muted-foreground">{p.nome}</p><div className="grid grid-cols-3 gap-1.5">{horas.map(h=><Button key={h} type="button" size="sm" variant={value===dia+'T'+h?'default':'outline'} aria-pressed={value===dia+'T'+h} className="h-9 rounded-lg tabular-nums" onClick={()=>{onChange(dia+'T'+h);setHoraAberta(false)}}>{h}</Button>)}</div></div>})}
     </PopoverContent>
    </Popover>
   </div>
  </div>
  <input id="request-date" type="hidden" value={value}/>
  {!habilitado&&<p className="text-xs text-muted-foreground">Selecione o pet e o serviço primeiro.</p>}
  {carregando&&<p role="status" className="text-xs text-muted-foreground">Consultando a agenda da equipe...</p>}
  {erro&&<div className="flex items-center gap-2 text-xs text-destructive">{erro}<Button type="button" size="sm" variant="ghost" onClick={()=>{setErro('');setResultado(null);setTentativa(t=>t+1)}}>Tentar novamente</Button></div>}
  {dia&&atual&&!slots.length&&<p className="text-xs text-amber-700">{atual.motivo==='dia-sem-escala'?'O pet shop não tem expediente disponível nesta data.':atual.motivo==='sem-profissional-servico'?'Nenhum profissional está escalado para este serviço neste dia.':'Os horários deste dia estão ocupados ou não comportam a duração do serviço.'} Escolha outra data ou consulte a equipe.</p>}
  {dia&&slots.length>0&&<p className="text-xs text-muted-foreground">Horários de 10 em 10 minutos. A equipe confirma a reserva.</p>}
 </div>
}
