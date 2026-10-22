'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  profissionalId?: string | null
  profissional?: { id: string; nome: string; especialidades: string | null; ativo: boolean } | null
  cliente: { id: string; nome: string; telefone: string }
  pet: { id: string; nome: string; especie: string }
}

export type AgendaProfessional = { id: string; nome: string; especialidades: string | null; ativo: boolean }
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

export function AgendaCalendar({onEdit,onCreateAt,onStatusChange,profissionais,refreshKey}:{
  onEdit:(item:AgendaCalendarEntry)=>void
  onCreateAt:(day:Date)=>void
  onStatusChange:(item:AgendaCalendarEntry,status:StatusAgendamento)=>Promise<void>
  profissionais:AgendaProfessional[]
  refreshKey:number
}) {
  const [referencia,setReferencia]=useState(()=>new Date())
  const [vista,setVista]=useState<Vista>('mes')
  const [items,setItems]=useState<AgendaCalendarEntry[]>([])
  const [loading,setLoading]=useState(true)
  const [erro,setErro]=useState<string|null>(null)
  const [truncado,setTruncado]=useState(false)
  const [busca,setBusca]=useState('')
  const [profissionalFiltro,setProfissionalFiltro]=useState('todos')
  const [organizarPor,setOrganizarPor]=useState<'profissional'|'status'>('profissional')
  const [alterandoStatus,setAlterandoStatus]=useState<string|null>(null)
  const kanbanRef=useRef<HTMLDivElement>(null)
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
        const res=await fetch('/api/agendamentos?'+params,{
          credentials:'same-origin',cache:'no-store',signal:abort.signal,
        })
        const data=await res.json().catch(()=>({}))
        if(!res.ok)throw new Error(data.error||'Falha ao consultar o calendário.')
        if(!abort.signal.aborted){
          setItems(data.items||[])
          setTruncado(Boolean(data.truncado))
        }
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

  useEffect(()=>{
    if(vista==='dia')kanbanRef.current?.scrollIntoView({behavior:'smooth',block:'start'})
  },[vista,referencia])
  async function atualizarStatus(item:AgendaCalendarEntry,proximo:StatusAgendamento){
    if(item.status===proximo)return
    if(proximo==='cancelado'&&!window.confirm('Cancelar o atendimento de '+item.pet.nome+'? O registro ficará no histórico.'))return
    setAlterandoStatus(item.id)
    try{await onStatusChange(item,proximo)}
    catch(error){toast.error(error instanceof Error?error.message:'Não foi possível atualizar o status.')}
    finally{setAlterandoStatus(null)}
  }
  const abrirDia=(day:Date)=>{setReferencia(day);setVista('dia')}
  const visiveis=useMemo(()=>{
    const termo=busca.trim().toLowerCase()
    return items.filter(x=>{
      if(status!=='todos'&&x.status!==status)return false
      if(profissionalFiltro==='sem-profissional'&&x.profissionalId)return false
      if(profissionalFiltro!=='todos'&&profissionalFiltro!=='sem-profissional'&&x.profissionalId!==profissionalFiltro)return false
      if(filtros.length&&!filtros.includes(categoriaAgendamento(x.servico,x.categoria)))return false
      return !termo||[x.servico,x.cliente.nome,x.pet.nome,x.observacoes,x.cliente.telefone]
        .some(t=>String(t||'').toLowerCase().includes(termo))
    })
  },[items,status,busca,filtros,profissionalFiltro])
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
      className={'relative z-10 block w-full truncate rounded border px-1.5 py-1 text-left text-[11px] font-medium transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary '+paleta[cat]+(x.status==='cancelado'?' line-through opacity-55':'')}>
      {format(parseISO(x.dataHora),'HH:mm')} · {x.pet.nome} — {x.servico}
    </button>
  }

  return <section aria-label="Calendário de agendamentos Matilha Prado" className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="size-5 text-primary"/>Calendário de atendimentos</h2>
        <p className="text-xs text-muted-foreground">Clique em uma data para abrir o Kanban do dia. Use + para agendar e clique no atendimento para editar.</p>
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
        <select aria-label="Filtrar profissional" className="h-9 max-w-[210px] rounded-md border bg-background px-2 text-xs" value={profissionalFiltro} onChange={e=>setProfissionalFiltro(e.target.value)}>
          <option value="todos">Todos os profissionais</option>
          <option value="sem-profissional">Sem profissional</option>
          {profissionais.map(p=><option key={p.id} value={p.id}>{p.nome}{p.ativo?'':' (inativo)'}</option>)}
        </select>
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
                  <button type="button" className="absolute inset-0 z-0 w-full cursor-pointer hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary" aria-label={'Abrir Kanban de '+format(day,'dd/MM/yyyy')} onClick={()=>abrirDia(day)}/>
                  <div className="relative z-10 mb-1 flex items-center justify-between pointer-events-none">
                    <button type="button" title={'Ver agenda de '+format(day,'dd/MM/yyyy')}
                      onClick={()=>abrirDia(day)}
                      className={'pointer-events-auto rounded px-1 text-xs font-semibold hover:bg-muted '+(noMes?'':'text-muted-foreground/60')+
                        (isSameDay(day,new Date())?' bg-primary text-primary-foreground':'')}>{format(day,'d')}</button>
                    <button type="button" title={'Criar agendamento em '+format(day,'dd/MM/yyyy')}
                      aria-label={'Novo agendamento em '+format(day,'dd/MM/yyyy')}
                      onClick={()=>onCreateAt(day)}
                      className="pointer-events-auto rounded p-0.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"><Plus className="size-3.5"/></button>
                  </div>
                  <div className="relative z-10 space-y-1">{events.slice(0,3).map(chip)}</div>
                  {events.length>3&&<button type="button" onClick={()=>abrirDia(day)}
                    className="relative z-10 mt-1 w-full truncate rounded bg-muted px-1 py-1 text-left text-[11px] hover:bg-muted/80">
                    + {events.length-3} compromisso(s)
                  </button>}
                </div>
              })}
            </div>
          </div>

        </div> : <div ref={kanbanRef} className="min-h-64 space-y-3 scroll-mt-4 rounded-xl border p-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div><p className="text-sm font-semibold capitalize">{format(referencia,"EEEE, dd 'de' LLLL",{locale:ptBR})}</p>
              <p className="text-xs text-muted-foreground">{(porDia.get(format(referencia,'yyyy-MM-dd'))||[]).length} atendimento(s) com os filtros atuais</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Organizar Kanban" className="h-9 rounded-md border bg-background px-2 text-xs" value={organizarPor}
                onChange={e=>setOrganizarPor(e.target.value as 'profissional'|'status')}>
                <option value="profissional">Colunas por profissional</option>
                <option value="status">Colunas por status</option>
              </select>
              <Button size="sm" variant="outline" onClick={()=>onCreateAt(referencia)}><Plus className="mr-1 size-4"/>Agendar neste dia</Button>
            </div>
          </div>
          {(()=>{
            const agendamentos=porDia.get(format(referencia,'yyyy-MM-dd'))||[]
            const colunas=organizarPor==='profissional'
              ? [...profissionais.filter(p=>p.ativo||agendamentos.some(a=>a.profissionalId===p.id)).map(p=>({id:p.id,label:p.nome,sub:p.especialidades||''})),{id:'sem-profissional',label:'Sem profissional',sub:'Aguardando atribuição'}]
              : (Object.entries(statusLabel) as [StatusAgendamento,string][]).map(([id,label])=>({id,label,sub:''}))
            return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {colunas.map(coluna=>{
                const eventos=agendamentos.filter(a=>organizarPor==='profissional'
                  ? (coluna.id==='sem-profissional'?!a.profissionalId:a.profissionalId===coluna.id)
                  : a.status===coluna.id)
                return <section key={coluna.id} className="min-w-0 rounded-xl border bg-muted/30 p-3">
                  <h3 className="flex items-center justify-between gap-2 text-sm font-semibold"><span className="truncate">{coluna.label}</span><span className="rounded-full bg-background px-2 py-0.5 text-xs tabular-nums">{eventos.length}</span></h3>
                  {coluna.sub&&<p className="mt-0.5 text-[11px] text-muted-foreground">{coluna.sub}</p>}
                  <div className="mt-3 space-y-2">
                    {eventos.length===0&&<p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">Sem agendamentos</p>}
                    {eventos.map(a=><article key={a.id} className={'space-y-2 rounded-lg border bg-card p-3 '+(a.status==='cancelado'?'opacity-60':'')}>
                      <button type="button" className="block w-full text-left focus-visible:outline-2 focus-visible:outline-primary" onClick={()=>onEdit(a)} aria-label={'Editar atendimento de '+a.pet.nome}>
                        <p className="text-xs font-semibold">{format(parseISO(a.dataHora),'HH:mm')} · {a.pet.nome}</p>
                        <p className="mt-1 text-xs">{a.cliente.nome} · {a.servico}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{a.profissional?.nome||'Sem profissional'} · {statusLabel[a.status]}</p>
                      </button>
                      <select aria-label={'Alterar status de '+a.pet.nome} className="h-8 w-full rounded-md border bg-background px-2 text-xs" value={a.status}
                        disabled={alterandoStatus===a.id} onChange={e=>void atualizarStatus(a,e.target.value as StatusAgendamento)}>
                        {Object.entries(statusLabel).map(([id,label])=><option key={id} value={id}>{label}</option>)}
                      </select>
                    </article>)}
                  </div>
                </section>
              })}
            </div>
          })()}
        </div>}
        <p className="mt-2 text-xs text-muted-foreground">
          {visiveis.length} agendamento(s) exibidos neste período. {truncado?'Exibição parcial por volume.':''}
        </p>
      </div>
    </div>
  </section>
}
