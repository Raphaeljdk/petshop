'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadCalendarPages } from '@/lib/daily-agenda'
import DailyAppointmentKanban from '@/components/agenda/daily-appointment-kanban'
import { addDays, addMonths, eachDayOfInterval, endOfDay, endOfMonth, endOfWeek,
  format, isSameDay, isSameMonth, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { StatusAgendamento } from '@/lib/types'
import { CATEGORIAS_AGENDA, inferirCategoriaAgenda, type CategoriaAgenda } from '@/lib/agenda-servicos'

export type AgendaCalendarEntry = {
  id: string; clienteId: string; petId: string; servico: string; categoria?: CategoriaAgenda; dataHora: string
  status: StatusAgendamento; observacoes: string | null; updatedAt: string
  cliente: { id: string; nome: string; telefone: string }
  pet: { id: string; nome: string; especie: string }
}

type Vista = 'mes' | 'semana' | 'dia'
const paleta: Record<CategoriaAgenda, string> = {
  Cirurgias: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300',
  Clínicos: 'bg-amber-100 text-amber-900 border-amber-300',
  'Day Care': 'bg-lime-100 text-lime-900 border-lime-300',
  Estéticos: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  Externos: 'bg-violet-100 text-violet-900 border-violet-300',
  Gerais: 'bg-sky-100 text-sky-900 border-sky-300',
  Hospedagens: 'bg-orange-100 text-orange-900 border-orange-300',
  Internações: 'bg-rose-100 text-rose-900 border-rose-300',
  Vacinas: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  Vermífugos: 'bg-teal-100 text-teal-900 border-teal-300',
}
export function categoriaAgendamento(servico: string, informada?: CategoriaAgenda): CategoriaAgenda {
  return informada && CATEGORIAS_AGENDA.includes(informada) ? informada : inferirCategoriaAgenda(servico)
}

const statusLabel: Record<StatusAgendamento,string> = {
  agendado:'Agendado', confirmado:'Em andamento', concluido:'Concluído', cancelado:'Cancelado',
}

export function AgendaCalendar({onEdit,onCreateAt,refreshKey,onChanged}:{
  onEdit:(item:AgendaCalendarEntry)=>void
  onCreateAt:(day:Date)=>void
  refreshKey:number
  onChanged:()=>void
}) {
  const [referencia,setReferencia]=useState(()=>new Date())
  const [vista,setVista]=useState<Vista>('mes')
  const [items,setItems]=useState<AgendaCalendarEntry[]>([])
  const [loading,setLoading]=useState(true)
  const [erro,setErro]=useState<string|null>(null)
  const [truncado,setTruncado]=useState(false)
  const [busca,setBusca]=useState('')
  const [status,setStatus]=useState<'todos' | StatusAgendamento>('todos')
  const [filtros,setFiltros]=useState<CategoriaAgenda[]>([])
  const [recarregar,setRecarregar]=useState(0)

  const {inicio,fim}=useMemo(()=>{
    if(vista==='dia')return {inicio:startOfDay(referencia),fim:endOfDay(referencia)}
    if(vista==='semana')return {inicio:startOfWeek(referencia,{weekStartsOn:0}),fim:endOfWeek(referencia,{weekStartsOn:0})}
    return {
      inicio:startOfWeek(startOfMonth(referencia),{weekStartsOn:0}),
      fim:endOfWeek(endOfMonth(referencia),{weekStartsOn:0}),
    }
  },[referencia,vista])
  const de=inicio.toISOString(), ate=fim.toISOString()
  useEffect(()=>{
    const abort=new AbortController()
    async function carregar(){
      setLoading(true);setErro(null)
      try {
        const params=new URLSearchParams({inicio:de,fim:ate})
        const data=await loadCalendarPages<AgendaCalendarEntry>('/api/agendamentos?'+params,abort.signal)
        if(!abort.signal.aborted){setItems(data);setTruncado(false)}
      }catch(e){
        if(!abort.signal.aborted){
          const message=e instanceof Error?e.message:'Falha ao carregar agenda.'
          setErro(message);toast.error(message)
        }
      }finally{if(!abort.signal.aborted)setLoading(false)}
    }
    void carregar()
    return ()=>abort.abort()
  },[de,ate,refreshKey,recarregar])

  const visiveis=useMemo(()=>{
    const termo=busca.trim().toLowerCase()
    return items.filter(x=>{
      if(status!=='todos'&&x.status!==status)return false
      if(filtros.length&&!filtros.includes(categoriaAgendamento(x.servico,x.categoria)))return false
      return !termo||[x.servico,x.cliente.nome,x.pet.nome,x.observacoes,x.cliente.telefone]
        .some(t=>String(t||'').toLowerCase().includes(termo))
    })
  },[items,status,busca,filtros])
  const porDia=useMemo(()=>{
    const map=new Map<string,AgendaCalendarEntry[]>()
    visiveis.forEach(x=>{
      const k=format(parseISO(x.dataHora),'yyyy-MM-dd')
      map.set(k,[...(map.get(k)||[]),x])
    })
    return map
  },[visiveis])
  const dias=useMemo(()=>eachDayOfInterval({start:inicio,end:fim}),[inicio,fim])
  const resumo=vista==='mes'
    ? format(referencia,'LLLL yyyy',{locale:ptBR})
    : vista==='semana'
      ? format(inicio,'dd/MM')+' — '+format(fim,'dd/MM/yyyy')
      : format(referencia,"EEEE, dd 'de' LLLL",{locale:ptBR})
  const mudar=(delta:number)=>{
    setReferencia(current=>vista==='mes'?addMonths(current,delta):addDays(current,delta*(vista==='semana'?7:1)))
  }
  const toggle=(c:CategoriaAgenda)=>setFiltros(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c])

  function chip(x:AgendaCalendarEntry){
    const cat=categoriaAgendamento(x.servico,x.categoria)
    return <button key={x.id} type="button" onClick={()=>onEdit(x)}
      title={format(parseISO(x.dataHora),'HH:mm')+' · '+x.pet.nome+' · '+x.cliente.nome+' · '+x.servico+' ('+statusLabel[x.status]+')'}
      className={'block w-full truncate rounded border px-1.5 py-1 text-left text-[11px] font-medium transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary '+paleta[cat]+(x.status==='cancelado'?' line-through opacity-55':'')}>
      {format(parseISO(x.dataHora),'HH:mm')} · {x.pet.nome} — {x.servico}
    </button>
  }

  return <section aria-label="Calendário de agendamentos Matilha Prado" className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="size-5 text-primary"/>Calendário de atendimentos</h2>
        <p className="text-xs text-muted-foreground">Clique no dia para abrir o Kanban diário; use + para agendar.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={()=>setReferencia(new Date())}>Hoje</Button>
        <Button variant="outline" size="sm" aria-label="Período anterior" onClick={()=>mudar(-1)}><ChevronLeft className="size-4"/></Button>
        <Button variant="outline" size="sm" aria-label="Próximo período" onClick={()=>mudar(1)}><ChevronRight className="size-4"/></Button>
        <span className="min-w-36 text-center text-sm font-semibold capitalize">{resumo}</span>
        <Button variant="outline" size="sm" disabled={loading} aria-label="Atualizar agenda" onClick={()=>setRecarregar(x=>x+1)}>
          <RefreshCw className={'size-4'+(loading?' animate-spin':'')}/>
        </Button>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-1">
        {([['mes','Mês'],['semana','Semana'],['dia','Dia']] as const).map(([mode,label])=>
          <Button key={mode} size="sm" variant={vista===mode?'default':'outline'} onClick={()=>setVista(mode)}>{label}</Button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filtrar status" className="h-9 rounded-md border bg-background px-2 text-xs" value={status}
          onChange={e=>setStatus(e.target.value as typeof status)}>
          <option value="todos">Todos os status</option>
          {Object.entries(statusLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <div className="relative"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"/>
          <Input className="h-9 w-44 pl-8 text-xs sm:w-60" placeholder="Pet, tutor ou serviço" value={busca}
            onChange={e=>setBusca(e.target.value)}/></div>
      </div>
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[190px_minmax(0,1fr)]">
      <aside className="space-y-1" aria-label="Filtrar tipos de atendimento">
        <div className="mb-2 flex items-center justify-between gap-1">
          <p className="text-xs font-semibold">Tipos de atendimento</p>
          <button type="button" className="text-xs text-primary underline" onClick={()=>setFiltros([])}>Todos</button>
        </div>
        {CATEGORIAS_AGENDA.map(c=>{
          const total=items.filter(x=>categoriaAgendamento(x.servico,x.categoria)===c).length
          const active=filtros.length===0||filtros.includes(c)
          return <button type="button" key={c} aria-pressed={filtros.includes(c)}
            onClick={()=>toggle(c)}
            className={'flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs transition hover:bg-muted '+(active?'bg-background':'opacity-45')}>
            <span className={'h-3 w-3 shrink-0 rounded-full border '+paleta[c]}/>
            <span className="flex-1">{c}</span><span className="tabular-nums text-muted-foreground">{total}</span>
          </button>
        })}
        <p className="pt-2 text-[11px] text-muted-foreground">As cores são atribuídas ao tipo de serviço. O filtro não altera os dados cadastrados.</p>
      </aside>
      <div className="min-w-0">
        {erro&&<div role="alert" className="mb-3 rounded-lg border border-destructive p-3 text-sm text-destructive">{erro}</div>}
        {truncado&&<div role="alert" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          Há mais de 500 agendamentos neste intervalo. Use Semana ou Dia para visualizar todos sem cortes.
        </div>}
        {loading&&<p role="status" className="mb-2 text-xs text-muted-foreground">Atualizando calendário...</p>}
        {vista!=='dia' ? <div className="overflow-x-auto rounded-xl border">
          <div className="min-w-[740px]">
            <div className="grid grid-cols-7 bg-muted/60 text-center text-xs font-semibold">
              {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=><div key={d} className="border-r px-1 py-2 last:border-r-0">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {dias.map(day=>{
                const key=format(day,'yyyy-MM-dd')
                const events=porDia.get(key)||[]
                const noMes=vista!=='mes'||isSameMonth(day,referencia)
                return <div key={key} className={'relative min-h-[130px] border-r border-t p-1.5 last:border-r-0 '+(!noMes?'bg-muted/40':'')+
                  (isSameDay(day,new Date())?' bg-primary/5':'')}>
                  <div className="mb-1 flex items-center justify-between">
                    <button type="button" title={'Ver agenda de '+format(day,'dd/MM/yyyy')}
                      onClick={()=>{setReferencia(day);setVista('dia')}}
                      className={'rounded px-1 text-xs font-semibold hover:bg-muted '+(noMes?'':'text-muted-foreground/60')+
                        (isSameDay(day,new Date())?' bg-primary text-primary-foreground':'')}>{format(day,'d')}</button>
                    <button type="button" title={'Criar agendamento em '+format(day,'dd/MM/yyyy')}
                      aria-label={'Novo agendamento em '+format(day,'dd/MM/yyyy')}
                      onClick={()=>onCreateAt(day)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"><Plus className="size-3.5"/></button>
                  </div>
                  <div className="space-y-1">{events.slice(0,3).map(chip)}</div>
                  {events.length>3&&<button type="button" onClick={()=>{setReferencia(day);setVista('dia')}}
                    className="mt-1 w-full truncate rounded bg-muted px-1 py-1 text-left text-[11px] hover:bg-muted/80">
                    + {events.length-3} compromisso(s)
                  </button>}
                </div>
              })}
            </div>
          </div>
        </div> : <DailyAppointmentKanban
          showCalendar={false} selectedDate={format(referencia,'yyyy-MM-dd')} loading={loading || Boolean(erro)}
          appointments={visiveis.map(x=>({id:x.id,startsAt:x.dataHora,status:x.status,customerName:x.cliente.nome,petName:x.pet.nome,serviceName:x.servico}))}
          statusColumns={Object.entries(statusLabel).map(([id,label])=>({id,label}))}
          allowedStatuses={x=>x.status==='cancelado'?['agendado']:Object.keys(statusLabel)}
          onOpen={x=>{const item=items.find(i=>i.id===x.id);if(item)onEdit(item)}}
          onCreate={()=>onCreateAt(referencia)}
          onStatusChange={async (x,status)=>{
            const original=items.find(i=>i.id===x.id)
            if(!original)throw new Error('Atualize a agenda antes de continuar.')
            const res=await fetch('/api/agendamentos/'+encodeURIComponent(x.id),{
              method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},
              body:JSON.stringify({status,expectedUpdatedAt:original.updatedAt}),
            })
            const data=await res.json().catch(()=>({}))
            if(!res.ok){setRecarregar(n=>n+1);throw new Error(data.error||'Não foi possível salvar o status.')}
            setItems(current=>current.map(i=>i.id===x.id?data:i))
            onChanged()
          }}
        />}
        <p className="mt-2 text-xs text-muted-foreground">
          {visiveis.length} agendamento(s) exibidos neste período. {truncado?'Exibição parcial por volume.':''}
        </p>
      </div>
    </div>
  </section>
}

