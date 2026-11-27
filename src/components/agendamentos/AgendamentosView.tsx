'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, CalendarDays, Clock, History, Plus, RefreshCw, Search, X, Pencil, Trash2 } from 'lucide-react'
import { addDays, format, isSameDay, parseISO, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import type { StatusAgendamento } from '@/lib/types'
import { AgendaCalendar, type AgendaCalendarEntry, type AgendaProfessional } from './AgendaCalendar'
import { ConfiguracaoServicosEsteticos } from './ConfiguracaoServicosEsteticos'
import { CATEGORIAS_AGENDA, SUGESTOES_AGENDA, inferirCategoriaAgenda, type CategoriaAgenda } from '@/lib/agenda-servicos'

type Entry = AgendaCalendarEntry
type Tutor = { id: string; nome: string; pets: Array<{ id: string; nome: string; especie: string }> }
type AgendaBloqueio = { id: string; inicio: string; fim: string; motivo: string; profissional: string }
type Form = { clienteId: string; petId: string; servico: string; categoria: CategoriaAgenda; dataHora: string; observacoes: string; status: StatusAgendamento; profissionalId: string }
const empty: Form = { clienteId: '', petId: '', servico: 'Banho', categoria: 'Estéticos', dataHora: '', observacoes: '', status: 'agendado', profissionalId: '' }
const statusMap: Record<StatusAgendamento, { label: string; className: string }> = {
  agendado: { label: 'Agendado', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  confirmado: { label: 'Em andamento', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-800 border-green-200' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-800 border-red-200' },
}
const dateInput = (iso: string) => {
  const d = new Date(iso)
  const z = (n: number) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + z(d.getMonth()+1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes())
}
async function parseResponse(res: Response) {
  const value = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(value.error || 'Operação não concluída')
  return value
}
export function AgendamentosView() {
  const [items, setItems] = useState<Entry[]>([])
  const [tutores, setTutores] = useState<Tutor[]>([])
  const [profissionais, setProfissionais] = useState<AgendaProfessional[]>([])
  const [bloqueios, setBloqueios] = useState<AgendaBloqueio[]>([])
  const [nomeProfissional, setNomeProfissional] = useState('')
  const [especialidadesProfissional, setEspecialidadesProfissional] = useState('')
  const [savingProfessional, setSavingProfessional] = useState(false)
  const [editingProfessionalId, setEditingProfessionalId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [erroAgenda, setErroAgenda] = useState('')
  const [saving, setSaving] = useState(false)
  const [buscar, setBuscar] = useState('')
  const [status, setStatus] = useState('todos')
  const [periodo, setPeriodo] = useState('todos')
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>({ ...empty })
  const [historico, setHistorico] = useState<Array<{ id: string; acao: string; createdAt: string; detalhe: string | null }>>([])
  const [verHistoricoId, setVerHistoricoId] = useState<string | null>(null)
  const [calendarRefresh, setCalendarRefresh] = useState(0)
  const [servicosPersonalizados, setServicosPersonalizados] = useState<string[]>([])
  useEffect(() => {
    let active = true
    fetch('/api/admin/agenda/servicos', { cache: 'no-store', credentials: 'same-origin' })
      .then(parseResponse)
      .then(data => {
        if (active) setServicosPersonalizados(
          (data.items as Array<{ nome: string; chave: string }>)
            .filter(item => item.chave.startsWith('personalizado-')).map(item => item.nome)
        )
      })
      .catch(() => {}) // A lista de sugestões padrão permanece disponível se a consulta falhar.
    return () => { active = false }
  }, [])
  const servicosSugeridos = useMemo(
    () => form.categoria === 'Estéticos'
      ? Array.from(new Set([...SUGESTOES_AGENDA.Estéticos, ...servicosPersonalizados]))
      : SUGESTOES_AGENDA[form.categoria],
    [form.categoria, servicosPersonalizados]
  )

  const carregar = useCallback(async () => {
    setLoading(true)
    // A lista principal não pode sumir se clientes, profissionais ou bloqueios falharem.
    const [resAgenda, resTutores, resProfissionais, resBloqueios] = await Promise.allSettled([
      fetch('/api/agendamentos?pagina=' + pagina, { cache: 'no-store', credentials: 'same-origin' }).then(parseResponse),
      fetch('/api/clientes', { cache: 'no-store', credentials: 'same-origin' }).then(parseResponse),
      fetch('/api/agenda/profissionais', { cache: 'no-store', credentials: 'same-origin' }).then(parseResponse),
      fetch('/api/agenda/bloqueios', { cache: 'no-store', credentials: 'same-origin' }).then(parseResponse),
    ])
    if (resAgenda.status === 'fulfilled') {
      setItems(Array.isArray(resAgenda.value.items) ? resAgenda.value.items : [])
      setTotal(resAgenda.value.total || 0)
      setErroAgenda('')
    } else {
      const message = resAgenda.reason instanceof Error ? resAgenda.reason.message : 'Erro ao carregar agendamentos.'
      setErroAgenda(message)
      toast.error('Não foi possível carregar agendamentos: ' + message)
    }
    if (resTutores.status === 'fulfilled') setTutores(Array.isArray(resTutores.value) ? resTutores.value : [])
    else toast.error('Não foi possível consultar tutores para novos agendamentos.')
    if (resProfissionais.status === 'fulfilled') setProfissionais(Array.isArray(resProfissionais.value.items) ? resProfissionais.value.items : [])
    else toast.error('Não foi possível consultar profissionais.')
    if (resBloqueios.status === 'fulfilled') setBloqueios(Array.isArray(resBloqueios.value.items) ? resBloqueios.value.items : [])
    else toast.error('Não foi possível consultar horários bloqueados. A lista de agendamentos continua disponível.')
    setLoading(false)
  }, [pagina])
  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => {
    const open = () => novo()
    window.addEventListener('agendamentos:novo', open)
    return () => window.removeEventListener('agendamentos:novo', open)
  }, [])

  function novo() {
    setEditId(null)
    setForm({ ...empty, dataHora: dateInput(new Date(Date.now() + 60*60_000).toISOString()) })
    setFormOpen(true)
  }
  function novoNaData(day: Date) {
    const selected = new Date(day)
    selected.setHours(9, 0, 0, 0)
    setEditId(null)
    setForm({ ...empty, dataHora: dateInput(selected.toISOString()) })
    setFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function editarDaAgenda(x: Entry) {
    editar(x)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function editar(x: Entry) {
    setEditId(x.id)
    setForm({ clienteId: x.clienteId, petId: x.petId, servico: x.servico, categoria: x.categoria || inferirCategoriaAgenda(x.servico), dataHora: dateInput(x.dataHora), observacoes: x.observacoes || '', status: x.status, profissionalId: x.profissionalId || '' })
    setFormOpen(true)
  }
  const petsTutor = tutores.find(x => x.id === form.clienteId)?.pets || []
  const filtrados = useMemo(() => {
    const hoje = startOfDay(new Date())
    const term = buscar.trim().toLowerCase()
    return items.filter(x => {
      const data = parseISO(x.dataHora)
      if (periodo === 'hoje' && !isSameDay(data, hoje)) return false
      if (periodo === '7dias' && (data < hoje || data > addDays(hoje,7))) return false
      if (periodo === '30dias' && (data < hoje || data > addDays(hoje,30))) return false
      if (periodo === 'historico' && data >= hoje && x.status !== 'cancelado' && x.status !== 'concluido') return false
      if (status !== 'todos' && x.status !== status) return false
      return !term || [x.pet?.nome, x.cliente?.nome, x.servico, x.observacoes, x.cliente?.telefone].some(v=>String(v||'').toLowerCase().includes(term))
    })
  },[items,buscar,periodo,status])
  const todayCount = items.filter(x=>isSameDay(parseISO(x.dataHora), new Date())).length
  const openCount = items.filter(x=>['agendado','confirmado'].includes(x.status)).length

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.petId || !form.clienteId || !form.dataHora) { toast.error('Selecione o tutor, o pet e o horário.'); return }
    setSaving(true)
    try {
      const payload = { ...form, dataHora: new Date(form.dataHora).toISOString() }
      const body = editId ? { ...payload, profissionalId: payload.profissionalId || null } : { clienteId: payload.clienteId, petId: payload.petId, servico: payload.servico, categoria: payload.categoria, dataHora: payload.dataHora, observacoes: payload.observacoes, profissionalId: payload.profissionalId || null }
      await parseResponse(await fetch('/api/agendamentos' + (editId ? '/' + editId : ''), {
        method: editId ? 'PATCH' : 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }))
      toast.success(editId ? 'Agendamento atualizado.' : 'Agendamento criado.')
      setFormOpen(false); setPagina(1); setCalendarRefresh(n=>n+1); await carregar()
    } catch(e) { toast.error(e instanceof Error ? e.message : 'Falha ao salvar agendamento.') }
    finally { setSaving(false) }
  }
  async function alterarStatusDaAgenda(x: Entry, novoStatus: StatusAgendamento) {
    await parseResponse(await fetch('/api/agendamentos/' + x.id, {
      method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus }),
    }))
    toast.success('Status atualizado.')
    setCalendarRefresh(n => n + 1)
    await carregar()
  }
  async function adicionarProfissional(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSavingProfessional(true)
    try {
      await parseResponse(await fetch('/api/agenda/profissionais', {
        method: editingProfessionalId ? 'PATCH' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(editingProfessionalId ? { id: editingProfessionalId } : {}), nome: nomeProfissional, especialidades: especialidadesProfissional || null }),
      }))
      toast.success(editingProfessionalId ? 'Profissional atualizado.' : 'Profissional cadastrado.')
      limparEdicaoProfissional(); setCalendarRefresh(n => n + 1); await carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao cadastrar profissional.') }
    finally { setSavingProfessional(false) }
  }
  function limparEdicaoProfissional() {
    setEditingProfessionalId(null); setNomeProfissional(''); setEspecialidadesProfissional('')
  }
  function editarProfissional(profissional: AgendaProfessional) {
    setEditingProfessionalId(profissional.id)
    setNomeProfissional(profissional.nome)
    setEspecialidadesProfissional(profissional.especialidades ?? '')
    document.getElementById('profissional-nome')?.focus()
  }
  async function excluirProfissional(profissional: AgendaProfessional) {
    if (!window.confirm('Excluir ' + profissional.nome + '? Só é permitido excluir profissionais sem vínculos e sem histórico.')) return
    setSavingProfessional(true)
    try {
      await parseResponse(await fetch('/api/agenda/profissionais', {
        method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profissional.id }),
      }))
      if (editingProfessionalId === profissional.id) limparEdicaoProfissional()
      toast.success('Profissional excluído.')
      setCalendarRefresh(n => n + 1)
      await carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível excluir profissional.') }
    finally { setSavingProfessional(false) }
  }
  async function alternarProfissional(profissional: AgendaProfessional) {
    setSavingProfessional(true)
    try {
      await parseResponse(await fetch('/api/agenda/profissionais', {
        method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profissional.id, ativo: !profissional.ativo }),
      }))
      toast.success(profissional.ativo ? 'Profissional desativado.' : 'Profissional reativado.')
      setCalendarRefresh(n => n + 1); await carregar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível atualizar profissional.') }
    finally { setSavingProfessional(false) }
  }
  async function cancelar(x: Entry) {
    if (!window.confirm('Cancelar agendamento de ' + x.pet.nome + '? Ele permanecerá no histórico.')) return
    setSaving(true)
    try {
      await parseResponse(await fetch('/api/agendamentos/' + x.id, { method: 'DELETE', credentials: 'same-origin' }))
      toast.success('Agendamento cancelado; histórico preservado.')
      setCalendarRefresh(n=>n+1)
      await carregar()
    } catch(e) { toast.error(e instanceof Error ? e.message : 'Erro ao cancelar.') }
    finally { setSaving(false) }
  }
  async function verHistorico(id: string) {
    try {
      const events = await parseResponse(await fetch('/api/agendamentos/' + id + '/historico', { cache:'no-store' }))
      setHistorico(events); setVerHistoricoId(id)
    } catch(e) { toast.error(e instanceof Error ? e.message : 'Erro no histórico.') }
  }
  return <div className="space-y-5 pb-10">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-bold sm:text-2xl">Agenda Matilha Prado</h1><p className="text-sm text-muted-foreground">Agenda própria: reserve, remarque, cancele e acompanhe o histórico de cada pet.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>void carregar()} disabled={loading}><RefreshCw className="mr-1.5 size-4" />Atualizar</Button><Button variant="outline" onClick={() => window.dispatchEvent(new Event('matilha:novo-servico'))}><Plus className="mr-1.5 size-4" />Novo serviço</Button><Button onClick={novo}><Plus className="mr-1.5 size-4" />Novo agendamento</Button></div>
    </div>
    <div className="grid grid-cols-3 gap-3">
      {[{name:'Hoje',value:todayCount},{name:'Ativos',value:openCount},{name:'Registros',value:total}].map(c=><Card key={c.name}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{c.name}</p><p className="mt-1 text-2xl font-bold">{c.value}</p></CardContent></Card>)}
    </div>
    <section className="rounded-xl border bg-card p-3 sm:p-4" aria-labelledby="agenda-equipe">
      <h2 id="agenda-equipe" className="text-sm font-semibold">Profissionais e agendas individuais ({profissionais.filter(x=>x.ativo).length} ativos)</h2>
      <p className="mt-2 text-xs text-muted-foreground">Cadastre quem atende banho, tosa e os demais serviços. Agendamentos antigos sem profissional permanecem intactos.</p>
      <form onSubmit={adicionarProfissional} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-44 flex-1 space-y-1"><Label htmlFor="profissional-nome">Nome *</Label><Input id="profissional-nome" required minLength={2} maxLength={80} value={nomeProfissional} onChange={e=>setNomeProfissional(e.target.value)} placeholder="Nome do profissional"/></div>
        <div className="min-w-44 flex-1 space-y-1"><Label htmlFor="profissional-servicos">Especialidades</Label><Input id="profissional-servicos" maxLength={200} value={especialidadesProfissional} onChange={e=>setEspecialidadesProfissional(e.target.value)} placeholder="Ex.: Banho e tosa"/></div>
        <Button type="submit" disabled={savingProfessional}>{savingProfessional?'Salvando...':editingProfessionalId?'Salvar alterações':'Adicionar profissional'}</Button>
        {editingProfessionalId && <Button type="button" variant="outline" disabled={savingProfessional} onClick={limparEdicaoProfissional}>Cancelar edição</Button>}
      </form>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {profissionais.map(p=><div key={p.id} className="flex flex-col gap-3 rounded-lg border bg-background p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0"><p className="break-words text-sm font-semibold">{p.nome}</p><p className="break-words text-xs text-muted-foreground">{p.especialidades || 'Especialidades não informadas'}</p></div>
            <Badge variant={p.ativo?'default':'secondary'}>{p.ativo?'Ativo':'Inativo'}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={savingProfessional} onClick={()=>editarProfissional(p)}><Pencil className="mr-1 size-3.5"/>Editar</Button>
            <Button type="button" size="sm" variant="outline" disabled={savingProfessional} onClick={()=>void alternarProfissional(p)}>{p.ativo?'Desativar':'Reativar'}</Button>
            <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={savingProfessional} onClick={()=>void excluirProfissional(p)} aria-label={'Excluir ' + p.nome}><Trash2 className="mr-1 size-3.5"/>Excluir</Button>
          </div>
        </div>)}
        {!profissionais.length&&<p className="text-xs text-muted-foreground">Nenhum profissional cadastrado ainda.</p>}
      </div>
    </section>
    <details className="rounded-xl border bg-card p-3 sm:p-4">
      <summary className="cursor-pointer text-sm font-semibold">Horários bloqueados pela equipe ({bloqueios.length})</summary>
      <p className="mt-2 text-xs text-muted-foreground">André e Aleksander gerenciam os bloqueios na agenda operacional. A administração consulta os períodos aqui.</p>
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {!bloqueios.length && <p className="text-sm text-muted-foreground">Sem períodos bloqueados.</p>}
        {bloqueios.map(b=><div key={b.id} className="rounded-lg border px-3 py-2 text-xs">
          <strong>{b.profissional}</strong> · {b.motivo} · {new Date(b.inicio).toLocaleString('pt-BR')} até {new Date(b.fim).toLocaleString('pt-BR')}
        </div>)}
      </div>
    </details>
    <ConfiguracaoServicosEsteticos onServicoCriado={nome => setServicosPersonalizados(prev => Array.from(new Set([...prev, nome])))} />
    {formOpen && <Card className="border-primary/30"><CardContent className="p-4 sm:p-6">
      <form onSubmit={salvar} className="space-y-4">
        <div className="flex justify-between items-center"><h2 className="font-semibold">{editId?'Editar / remarcar':'Novo agendamento'}</h2><Button variant="ghost" type="button" onClick={()=>setFormOpen(false)} aria-label="Fechar"><X className="size-4"/></Button></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="agenda-tutor">Cliente / tutor *</Label><select id="agenda-tutor" required className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.clienteId}
            onChange={e=>setForm(f=>({...f,clienteId:e.target.value,petId:''}))}><option value="">Selecione o tutor</option>{tutores.map(c=><option value={c.id} key={c.id}>{c.nome}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="agenda-pet">Pet *</Label><select id="agenda-pet" required className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.petId}
            onChange={e=>setForm(f=>({...f,petId:e.target.value}))}><option value="">Selecione o pet</option>{petsTutor.map(p=><option value={p.id} key={p.id}>{p.nome} · {p.especie}</option>)}</select></div>
          <div className="space-y-1.5">
            <Label htmlFor="agenda-categoria">Tipo de atendimento *</Label>
            <select id="agenda-categoria" required className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.categoria}
              onChange={e=>{
                const categoria=e.target.value as CategoriaAgenda
                setForm(f=>({...f,categoria,servico:SUGESTOES_AGENDA[categoria][0]}))
              }}>
              {CATEGORIAS_AGENDA.filter(c => c !== 'Hospedagens' || (editId !== null && form.categoria === 'Hospedagens')).map(c=><option value={c} key={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agenda-servico-opcao">Serviço sugerido</Label>
            <select id="agenda-servico-opcao" className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={servicosSugeridos.includes(form.servico)?form.servico:''}
              onChange={e=>setForm(f=>({...f,servico:e.target.value||f.servico}))}>
              <option value="">Descrição personalizada</option>
              {servicosSugeridos.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="agenda-servico">Descrição do serviço *</Label>
            <Input id="agenda-servico" required value={form.servico} maxLength={140}
              onChange={e=>setForm(f=>({...f,servico:e.target.value}))}
              placeholder="Descreva o serviço que será realizado"/>
            <p className="text-xs text-muted-foreground">Categorias clínicas, cirúrgicas, vacinas e internações são somente classificações administrativas. Agende apenas procedimentos que a empresa está habilitada a prestar.</p>
          </div>
          <div className="space-y-1.5"><Label htmlFor="agenda-profissional">Profissional responsável</Label><select id="agenda-profissional" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.profissionalId} onChange={e=>setForm(f=>({...f,profissionalId:e.target.value}))}>
            <option value="">Atribuir depois / sem profissional</option>
            {profissionais.filter(p=>p.ativo||p.id===form.profissionalId).map(p=><option key={p.id} value={p.id}>{p.nome}{p.especialidades?' · '+p.especialidades:''}{p.ativo?'':' (inativo)'}</option>)}
          </select></div>
          <div className="space-y-1.5"><Label htmlFor="agenda-data">Data e horário *</Label><Input id="agenda-data" type="datetime-local" required value={form.dataHora} onChange={e=>setForm(f=>({...f,dataHora:e.target.value}))}/></div>
          {editId && <div className="space-y-1.5"><Label htmlFor="agenda-status">Status</Label><select id="agenda-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value as StatusAgendamento}))}>
            {Object.entries(statusMap).map(([k,v])=><option value={k} key={k}>{v.label}</option>)}</select></div>}
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="agenda-obs">Observações</Label><Input id="agenda-obs" maxLength={1500} value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Preferências e cuidados..."/></div>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setFormOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving?'Salvando...':editId?'Salvar alterações':'Agendar'}</Button></div>
      </form>
    </CardContent></Card>}
    <AgendaCalendar onEdit={editarDaAgenda} onCreateAt={novoNaData} onStatusChange={alterarStatusDaAgenda} profissionais={profissionais} refreshKey={calendarRefresh}/>
    <details open className="rounded-2xl border bg-card p-3 sm:p-4">
      <summary className="cursor-pointer rounded-md text-sm font-semibold hover:text-primary">
        Lista de agendamentos e histórico detalhado ({total})
      </summary>
      <div className="mt-4 space-y-3">
    <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"/><Input className="pl-9" value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar pet, tutor, serviço..."/></div>
      <select aria-label="Período" className="h-10 rounded-md border bg-background px-3 text-sm" value={periodo} onChange={e=>setPeriodo(e.target.value)}>
        <option value="hoje">Hoje</option><option value="7dias">Próximos 7 dias</option><option value="30dias">Próximos 30 dias</option><option value="historico">Histórico</option><option value="todos">Todos</option>
      </select>
      <select aria-label="Status" className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="todos">Todos os status</option>{Object.entries(statusMap).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
    </div>
    {erroAgenda && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Falha ao consultar agendamentos: {erroAgenda}. Tente atualizar ou entre novamente.</p>}
    {loading?<SkeletonLoader type="list" count={5}/>:erroAgenda ? null : filtrados.length===0?<Card><CardContent className="py-12 text-center"><CalendarClock className="mx-auto size-8 text-muted-foreground"/><p className="mt-3 font-medium">Nenhum agendamento encontrado</p><p className="text-sm text-muted-foreground">Nenhum registro nesse filtro. Selecione Todos ou Histórico para visualizar os anteriores.</p></CardContent></Card>:
      <div className="grid gap-3 lg:grid-cols-2">{filtrados.map(x=><Card key={x.id}><CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><CalendarDays className="size-5"/></div>
          <div><p className="font-semibold">{x.pet.nome} · {x.servico}</p><p className="text-xs text-muted-foreground">{x.cliente.nome} · {x.cliente.telefone}</p></div></div>
          <Badge className={statusMap[x.status]?.className}>{statusMap[x.status]?.label}</Badge></div>
        <p className="flex items-center gap-2 text-sm"><Clock className="size-4 text-muted-foreground"/>{format(parseISO(x.dataHora), "dd/MM/yyyy 'às' HH:mm", {locale:ptBR})}</p>
        {x.observacoes && <p className="border-l-2 pl-3 text-xs text-muted-foreground">{x.observacoes}</p>}
        <div className="flex flex-wrap gap-2 border-t pt-3"><Button variant="outline" size="sm" onClick={()=>editar(x)}>Editar / remarcar</Button>
          <Button variant="outline" size="sm" onClick={()=>void verHistorico(x.id)}><History className="mr-1 size-4"/>Histórico</Button>
          {x.status!=='cancelado'&&<Button variant="outline" size="sm" className="text-destructive" disabled={saving} onClick={()=>void cancelar(x)}>Cancelar</Button>}
        </div>
        {verHistoricoId===x.id && <div className="rounded-lg bg-muted p-3 text-xs"><p className="font-semibold">Movimentações do agendamento</p>{historico.length?historico.map(h=><p key={h.id} className="mt-1 text-muted-foreground">{format(parseISO(h.createdAt),'dd/MM/yyyy HH:mm')} · {h.acao}{h.detalhe?' — '+h.detalhe:''}</p>):<p>Sem eventos registrados.</p>}</div>}
      </CardContent></Card>)}</div>}
    {total>100 && <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={pagina<=1} onClick={()=>setPagina(n=>n-1)}>Anterior</Button><span className="text-xs text-muted-foreground">Página {pagina} de {Math.ceil(total/100)}</span><Button variant="outline" disabled={pagina*100>=total} onClick={()=>setPagina(n=>n+1)}>Próximo</Button></div>}      </div>
    </details>
  </div>
}
