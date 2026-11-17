'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, ClipboardList, MapPin, RefreshCw } from 'lucide-react'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type Area = 'kanban' | 'agenda' | 'entregas'
type Tutor = { id: string; nome: string; pets: Array<{ id: string; nome: string; especie: string }> }
type AgendaItem = {
  id: string; dataHora: string; status: string; servico: string
  pet?: { nome: string }; cliente?: { nome: string; telefone?: string }
}
type Entrega = {
  id: string; createdAt: string; tipoEntrega: string | null; statusEntrega: string
  nomeCliente: string; telefoneCliente: string | null
  enderecoEntrega: string | null; cepEntrega: string | null
  enderecoCadastrado: string | null; cepCadastrado: string | null
}

function dateTimeLocal(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return value.getFullYear() + '-' + pad(value.getMonth() + 1) + '-' + pad(value.getDate()) +
    'T' + pad(value.getHours()) + ':' + pad(value.getMinutes())
}
function dateDisplay(value: string): string {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
async function loadJson(res: Response) {
  const result = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(result.error || 'Não foi possível concluir a operação.')
  return result
}

export function AndreOperations() {
  const [area, setArea] = useState<Area>('kanban')
  const [buscaTutor, setBuscaTutor] = useState('')
  const [tutores, setTutores] = useState<Tutor[]>([])
  const [tutor, setTutor] = useState<Tutor | null>(null)
  const [petId, setPetId] = useState('')
  const [dataHora, setDataHora] = useState(() => dateTimeLocal(new Date(Date.now() + 60 * 60_000)))
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [agenda, setAgenda] = useState<AgendaItem[]>([])
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [loadingAgenda, setLoadingAgenda] = useState(false)
  const [loadingEntregas, setLoadingEntregas] = useState(false)

  const carregarAgenda = useCallback(async () => {
    setLoadingAgenda(true)
    try {
      const inicio = new Date()
      inicio.setDate(inicio.getDate() - 7)
      inicio.setHours(0, 0, 0, 0)
      const fim = new Date()
      fim.setDate(fim.getDate() + 30)
      fim.setHours(23, 59, 59, 999)
      const qs = new URLSearchParams({ inicio: inicio.toISOString(), fim: fim.toISOString() })
      const result = await loadJson(await fetch('/api/agendamentos?' + qs.toString(), { cache: 'no-store' }))
      setAgenda(result.items || [])
      if (result.truncado) toast.info('A lista atingiu o limite. Consulte outro período com a administração.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao consultar agenda.')
    } finally { setLoadingAgenda(false) }
  }, [])

  const carregarEntregas = useCallback(async () => {
    setLoadingEntregas(true)
    try {
      const result = await loadJson(await fetch('/api/operacional/entregas', { cache: 'no-store' }))
      setEntregas(result.items || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao consultar entregas.')
    } finally { setLoadingEntregas(false) }
  }, [])

  useEffect(() => {
    if (area === 'agenda') void carregarAgenda()
    if (area === 'entregas') void carregarEntregas()
  }, [area, carregarAgenda, carregarEntregas])

  useEffect(() => {
    if (area !== 'agenda' || buscaTutor.trim().length < 2) { setTutores([]); return }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const url = '/api/operacional/clientes?busca=' + encodeURIComponent(buscaTutor.trim())
        const result = await loadJson(await fetch(url, { cache: 'no-store', signal: controller.signal }))
        if (!controller.signal.aborted) setTutores(result.items || [])
      } catch (error) {
        if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : 'Falha ao buscar tutores.')
      }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [buscaTutor, area])

  async function agendarBanho(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (salvando) return
    if (!tutor || !petId) { toast.error('Selecione um tutor e o pet.'); return }
    const horario = new Date(dataHora)
    if (!Number.isFinite(horario.getTime()) || horario.getTime() < Date.now()) {
      toast.error('Selecione um horário futuro válido.'); return
    }
    setSalvando(true)
    try {
      await loadJson(await fetch('/api/agendamentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          clienteId: tutor.id, petId, servico: 'Banho', categoria: 'Estéticos',
          dataHora: horario.toISOString(), observacoes: observacoes.trim(),
        }),
      }))
      toast.success('Banho agendado com sucesso.')
      setTutor(null)
      setPetId('')
      setBuscaTutor('')
      setObservacoes('')
      await carregarAgenda()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível agendar o banho.')
    } finally { setSalvando(false) }
  }

  return <div className="mx-auto max-w-6xl space-y-5">
    <nav aria-label="Acesso operacional" className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant={area === 'kanban' ? 'default' : 'outline'} aria-pressed={area === 'kanban'} onClick={() => setArea('kanban')}><ClipboardList className="size-4" /> Kanban de pets</Button>
      <Button type="button" size="sm" variant={area === 'agenda' ? 'default' : 'outline'} aria-pressed={area === 'agenda'} onClick={() => setArea('agenda')}><CalendarDays className="size-4" /> Banhos e agendamentos</Button>
      <Button type="button" size="sm" variant={area === 'entregas' ? 'default' : 'outline'} aria-pressed={area === 'entregas'} onClick={() => setArea('entregas')}><MapPin className="size-4" /> Endereços de entrega</Button>
    </nav>

    {area === 'kanban' && <KanbanBoard limitedAccess />}

    {area === 'agenda' && <div className="grid gap-4 lg:grid-cols-[minmax(270px,0.85fr)_1.15fr]">
      <section className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="text-lg font-semibold">Marcar banho</h2>
        <form onSubmit={agendarBanho} className="space-y-3">
          <label className="block text-sm font-medium">Buscar tutor
            <Input className="mt-1" type="search" placeholder="Digite pelo menos 2 letras" value={buscaTutor} onChange={e => { setBuscaTutor(e.target.value); setTutor(null); setPetId('') }} />
          </label>
          {tutores.length > 0 && <div className="max-h-40 overflow-y-auto rounded-lg border" role="listbox" aria-label="Tutores encontrados">
            {tutores.map(item => <button key={item.id} type="button" role="option" aria-selected={tutor?.id === item.id} className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-muted last:border-0" onClick={() => { setTutor(item); setPetId(''); setTutores([]); setBuscaTutor(item.nome) }}>
              {item.nome} <span className="text-muted-foreground">({item.pets.length} pet(s))</span>
            </button>)}
          </div>}
          {tutor && <p className="text-sm text-muted-foreground">Tutor selecionado: <strong className="text-foreground">{tutor.nome}</strong></p>}
          <label className="block text-sm font-medium">Pet
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" required value={petId} onChange={e => setPetId(e.target.value)} disabled={!tutor}>
              <option value="">Selecione</option>
              {tutor?.pets.map(p => <option key={p.id} value={p.id}>{p.nome} · {p.especie}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Data e horário
            <Input className="mt-1" type="datetime-local" value={dataHora} min={dateTimeLocal(new Date())} required onChange={e => setDataHora(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">Observações (opcional)
            <textarea className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" maxLength={1500} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </label>
          <Button type="submit" disabled={!tutor || !petId || salvando} className="w-full">{salvando ? 'Agendando...' : 'Confirmar agendamento de banho'}</Button>
        </form>
      </section>
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Consultar agendamentos</h2><p className="text-xs text-muted-foreground">Últimos 7 dias e próximos 30 dias · somente leitura</p></div>
          <Button type="button" size="sm" variant="outline" disabled={loadingAgenda} onClick={() => void carregarAgenda()}><RefreshCw className="size-4" /> Atualizar</Button>
        </div>
        <div className="max-h-[580px] space-y-2 overflow-y-auto">
          {loadingAgenda && !agenda.length && <p className="text-sm text-muted-foreground">Carregando agenda...</p>}
          {!loadingAgenda && !agenda.length && <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado no período.</p>}
          {agenda.map(item => <article key={item.id} className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <strong>{item.pet?.nome || 'Pet'} · {item.servico}</strong>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{item.status}</span>
            </div>
            <p className="mt-1">{dateDisplay(item.dataHora)}</p>
            <p className="text-muted-foreground">Tutor: {item.cliente?.nome || 'Não identificado'}</p>
          </article>)}
        </div>
      </section>
    </div>}

    {area === 'entregas' && <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-lg font-semibold">Endereços de entrega</h2><p className="text-xs text-muted-foreground">Pedidos em aberto · consulta somente leitura</p></div>
        <Button type="button" size="sm" variant="outline" disabled={loadingEntregas} onClick={() => void carregarEntregas()}><RefreshCw className="size-4" /> Atualizar</Button>
      </div>
      {loadingEntregas && !entregas.length && <p className="text-sm text-muted-foreground">Carregando endereços...</p>}
      {!loadingEntregas && !entregas.length && <p className="text-sm text-muted-foreground">Nenhuma entrega em aberto encontrada.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {entregas.map(item => <article key={item.id} className="rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between gap-2"><strong>{item.nomeCliente}</strong><span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{item.statusEntrega}</span></div>
          <p className="mt-1 text-xs text-muted-foreground">Pedido {item.id.slice(-8).toUpperCase()} · {dateDisplay(item.createdAt)}</p>
          {item.enderecoEntrega ? <p className="mt-2 font-medium"><MapPin className="mr-1 inline size-4" />{item.enderecoEntrega} {item.cepEntrega ? ' · CEP ' + item.cepEntrega : ''}</p>
            : item.enderecoCadastrado ? <div className="mt-2"><p className="font-medium">Endereço cadastral (destino não confirmado)</p><p>{item.enderecoCadastrado} {item.cepCadastrado ? ' · CEP ' + item.cepCadastrado : ''}</p></div>
            : <p className="mt-2 text-amber-700 dark:text-amber-300">Endereço não informado. Consulte a administração antes de entregar.</p>}
          {item.telefoneCliente && <p className="mt-1 text-muted-foreground">Contato: {item.telefoneCliente}</p>}
        </article>)}
      </div>
    </section>}
  </div>
}
