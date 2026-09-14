'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  CalendarX,
  Check,
  CheckCheck,
  Clock,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  CalendarDays,
  Hourglass,
  PartyPopper,
} from 'lucide-react'
import {
  addDays,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfWeek,
  endOfMonth,
  formatDistanceToNow,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExportButton } from '@/components/ui/ExportButton'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Agendamento, Pet, StatusAgendamento } from '@/lib/types'

/* --------------------------------------------------------------------- */
/* Helpers de status                                                     */
/* --------------------------------------------------------------------- */

interface StatusMeta {
  label: string
  badgeClass: string
  iconClass: string
  Icon: typeof Clock
}

const STATUS_META: Record<StatusAgendamento, StatusMeta> = {
  agendado: {
    label: 'Agendado',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    iconClass: 'text-blue-600',
    Icon: Clock,
  },
  confirmado: {
    label: 'Confirmado',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    iconClass: 'text-green-600',
    Icon: CheckCheck,
  },
  concluido: {
    label: 'Concluído',
    badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    iconClass: 'text-zinc-500',
    Icon: Check,
  },
  cancelado: {
    label: 'Cancelado',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    iconClass: 'text-red-600',
    Icon: X,
  },
}

const PERIODO_FILTRO = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'amanha', label: 'Amanhã' },
  { value: 'semana', label: 'Esta semana' },
  { value: '7dias', label: 'Próximos 7 dias' },
  { value: 'todos', label: 'Todos' },
] as const

type PeriodoFiltro = (typeof PERIODO_FILTRO)[number]['value']

/* --------------------------------------------------------------------- */
/* Componente: StatCard                                                  */
/* --------------------------------------------------------------------- */

function StatCard({
  title,
  value,
  icon: Icon,
  iconClass,
}: {
  title: string
  value: number | string
  icon: typeof Clock
  iconClass: string
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={cn(
            'size-10 rounded-lg flex items-center justify-center shrink-0',
            iconClass.replace('text-', 'bg-').replace('600', '50'),
            iconClass
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">{title}</p>
          <p className="text-lg font-semibold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

/* --------------------------------------------------------------------- */
/* Componente: CardAgendamento                                            */
/* --------------------------------------------------------------------- */

function CardAgendamento({
  agendamento,
  onEditar,
  onExcluir,
  onConfirmar,
  onConcluir,
  onCancelar,
  onReagendar,
}: {
  agendamento: Agendamento
  onEditar: () => void
  onExcluir: () => void
  onConfirmar: () => void
  onConcluir: () => void
  onCancelar: () => void
  onReagendar: () => void
}) {
  const meta = STATUS_META[agendamento.status]
  const Icon = meta.Icon
  const data = parseISO(agendamento.dataHora)
  const tempoRelativo = formatDistanceToNow(data, { addSuffix: true, locale: ptBR })

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Faixa horizontal com horário em destaque */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" />
          <span className="text-sm font-bold tabular-nums">
            {format(data, 'HH:mm')}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {format(data, "dd/MM/yyyy")}
          </span>
        </div>
        <Badge className={cn('text-[10px] border', meta.badgeClass)}>
          <Icon className={cn('size-3', meta.iconClass)} />
          {meta.label}
        </Badge>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">
              {agendamento.pet?.nome || 'Pet'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {agendamento.servico} — {agendamento.cliente?.nome || 'sem dono'}
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {tempoRelativo}
          </span>
        </div>

        {agendamento.observacoes && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2 line-clamp-2">
            “{agendamento.observacoes}”
          </p>
        )}

        {/* Ações rápidas */}
        <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-border">
          {agendamento.status === 'agendado' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] text-green-700 hover:text-green-800 hover:bg-green-50"
              onClick={onConfirmar}
            >
              <Check className="size-3" /> Confirmar
            </Button>
          )}
          {(agendamento.status === 'agendado' ||
            agendamento.status === 'confirmado') && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={onReagendar}
              >
                <CalendarClock className="size-3" /> Reagendar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] text-zinc-700 hover:text-zinc-800 hover:bg-zinc-50"
                onClick={onConcluir}
              >
                <CheckCheck className="size-3" /> Concluir
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] text-red-700 hover:text-red-800 hover:bg-red-50"
                onClick={onCancelar}
              >
                <X className="size-3" /> Cancelar
              </Button>
            </>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="size-7 ml-auto"
            onClick={onEditar}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-destructive"
            onClick={onExcluir}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------- */
/* Componente principal                                                   */
/* --------------------------------------------------------------------- */

export function AgendamentosView() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)

  const [diaSelecionado, setDiaSelecionado] = useState<Date>(new Date())
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('hoje')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Agendamento | null>(null)
  const [form, setForm] = useState({
    petId: '',
    servico: '',
    dataHora: '',
    observacoes: '',
    status: 'agendado' as StatusAgendamento,
  })

  const [reagendarOpen, setReagendarOpen] = useState(false)
  const [reagendarAlvo, setReagendarAlvo] = useState<Agendamento | null>(null)
  const [reagendarDataHora, setReagendarDataHora] = useState('')

  const [confirmExcluir, setConfirmExcluir] = useState<{
    id: string
    titulo: string
  } | null>(null)

  // filtros
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  const carregar = useCallback(async () => {
    try {
      const [resAg, resPets] = await Promise.all([
        fetch('/api/agendamentos', { credentials: 'same-origin' }),
        fetch('/api/pets', { credentials: 'same-origin' }),
      ])
      if (resAg.ok) setAgendamentos(await resAg.json())
      if (resPets.ok) setPets(await resPets.json())
    } catch (e) {
      console.error('agendamentos erro:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /* ---------------------- quick action via window event ---------------------- */

  // Quick action "Novo Agendamento" vinda do DashboardView — abre o dialog.
  useEffect(() => {
    const handler = () => abrirNovo()
    window.addEventListener('agendamentos:novo', handler)
    return () => window.removeEventListener('agendamentos:novo', handler)
  }, [])

  /* ---------------------- helpers de intervalo ---------------------- */

  const intervaloPeriodo = useMemo(() => {
    const hoje = startOfDay(new Date())
    if (periodo === 'hoje') {
      return { start: hoje, end: addDays(hoje, 1) }
    }
    if (periodo === 'amanha') {
      return { start: addDays(hoje, 1), end: addDays(hoje, 2) }
    }
    if (periodo === 'semana') {
      return {
        start: startOfWeek(hoje, { weekStartsOn: 0 }),
        end: endOfWeek(hoje, { weekStartsOn: 0 }),
      }
    }
    if (periodo === '7dias') {
      return { start: hoje, end: addDays(hoje, 7) }
    }
    // 'todos'
    return null
  }, [periodo])

  const agendamentosDoPeriodo = useMemo(() => {
    if (!intervaloPeriodo) return agendamentos
    return agendamentos.filter((a) => {
      const d = parseISO(a.dataHora)
      try {
        return isWithinInterval(d, intervaloPeriodo)
      } catch {
        return false
      }
    })
  }, [agendamentos, intervaloPeriodo])

  const agendamentosDoDia = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return agendamentos
      .filter((a) => isSameDay(parseISO(a.dataHora), diaSelecionado))
      .filter((a) => {
        if (filtroStatus !== 'todos' && a.status !== filtroStatus) return false
        if (termo) {
          const petNome = (a.pet?.nome || '').toLowerCase()
          const clienteNome = (a.cliente?.nome || '').toLowerCase()
          if (!petNome.includes(termo) && !clienteNome.includes(termo)) {
            return false
          }
        }
        return true
      })
      .sort(
        (a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()
      )
  }, [agendamentos, diaSelecionado, busca, filtroStatus])

  const temFiltrosAtivos = busca.trim() !== '' || filtroStatus !== 'todos'

  const limparFiltros = () => {
    setBusca('')
    setFiltroStatus('todos')
  }

  const diasComAgendamento = useMemo(() => {
    const set = new Set<string>()
    agendamentos.forEach((a) =>
      set.add(format(parseISO(a.dataHora), 'yyyy-MM-dd'))
    )
    return set
  }, [agendamentos])

  /* ---------------------- stats ---------------------- */

  const stats = useMemo(() => {
    const hoje = new Date()
    const hojeCount = agendamentos.filter((a) =>
      isSameDay(parseISO(a.dataHora), hoje)
    ).length
    const confirmados = agendamentos.filter(
      (a) => a.status === 'confirmado'
    ).length
    const pendentes = agendamentos.filter(
      (a) => a.status === 'agendado'
    ).length
    const concluidos = agendamentos.filter(
      (a) => a.status === 'concluido'
    ).length
    return { hojeCount, confirmados, pendentes, concluidos }
  }, [agendamentos])

  /* ---------------------- ações ---------------------- */

  const abrirNovo = () => {
    setEditando(null)
    setForm({
      petId: pets[0]?.id || '',
      servico: '',
      dataHora: `${format(diaSelecionado, 'yyyy-MM-dd')}T09:00`,
      observacoes: '',
      status: 'agendado',
    })
    setDialogOpen(true)
  }

  const abrirEdicao = (a: Agendamento) => {
    setEditando(a)
    setForm({
      petId: a.petId,
      servico: a.servico,
      dataHora: format(parseISO(a.dataHora), "yyyy-MM-dd'T'HH:mm"),
      observacoes: a.observacoes || '',
      status: a.status,
    })
    setDialogOpen(true)
  }

  const salvar = async () => {
    if (!form.petId || !form.servico || !form.dataHora) {
      toast.error('Preencha pet, serviço e data/hora')
      return
    }
    const pet = pets.find((p) => p.id === form.petId)
    if (!pet) {
      toast.error('Pet inválido')
      return
    }
    try {
      const url = editando
        ? `/api/agendamentos/${editando.id}`
        : '/api/agendamentos'
      const method = editando ? 'PATCH' : 'POST'
      const body: Record<string, unknown> = {
        petId: form.petId,
        clienteId: pet.clienteId,
        servico: form.servico,
        dataHora: new Date(form.dataHora).toISOString(),
        observacoes: form.observacoes || null,
        status: form.status,
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Erro ao salvar')
      }
      toast.success(editando ? 'Agendamento atualizado' : 'Agendamento criado')
      setDialogOpen(false)
      carregar()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar agendamento'
      toast.error(msg)
    }
  }

  const excluir = async (id: string) => {
    try {
      const res = await fetch(`/api/agendamentos/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error()
      toast.success('Agendamento excluído')
      carregar()
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  const mudarStatus = async (
    id: string,
    status: StatusAgendamento,
    msgOk: string
  ) => {
    try {
      const res = await fetch(`/api/agendamentos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success(msgOk)
      carregar()
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  const abrirReagendar = (a: Agendamento) => {
    setReagendarAlvo(a)
    setReagendarDataHora(format(parseISO(a.dataHora), "yyyy-MM-dd'T'HH:mm"))
    setReagendarOpen(true)
  }

  const salvarReagendar = async () => {
    if (!reagendarAlvo || !reagendarDataHora) return
    try {
      const res = await fetch(`/api/agendamentos/${reagendarAlvo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          dataHora: new Date(reagendarDataHora).toISOString(),
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Agendamento reagendado')
      setReagendarOpen(false)
      setReagendarAlvo(null)
      carregar()
    } catch {
      toast.error('Erro ao reagendar')
    }
  }

  /* ---------------------- render ---------------------- */

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Agendamentos
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Calendário de atendimentos
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportButton
            type="agendamentos"
            label="Exportar"
            variant="outline"
            className="h-9 sm:h-10"
          />
          <Button onClick={abrirNovo} className="h-9 sm:h-10">
            <Plus className="size-4" /> <span className="hidden sm:inline ml-1">Novo</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Hoje"
          value={stats.hojeCount}
          icon={CalendarDays}
          iconClass="text-primary"
        />
        <StatCard
          title="Confirmados"
          value={stats.confirmados}
          icon={CheckCheck}
          iconClass="text-green-600"
        />
        <StatCard
          title="Pendentes"
          value={stats.pendentes}
          icon={Hourglass}
          iconClass="text-amber-600"
        />
        <StatCard
          title="Concluídos"
          value={stats.concluidos}
          icon={PartyPopper}
          iconClass="text-zinc-600"
        />
      </div>

      {/* Filtros de busca */}
      <div className="bg-card/50 border border-border rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Buscar por nome do pet ou cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-[200px] h-9">
              <Filter className="size-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="agendado">Agendado</SelectItem>
              <SelectItem value="confirmado">Confirmado</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {temFiltrosAtivos && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              {agendamentosDoDia.length} agendamento(s) no dia filtrado(s)
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={limparFiltros}
              className="h-7 text-xs"
            >
              <X className="size-3" /> Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {/* Grid: Calendário + Lista do dia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" />
              Calendário
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center overflow-x-auto">
            <Calendar
              mode="single"
              selected={diaSelecionado}
              onSelect={(d) => d && setDiaSelecionado(d)}
              locale={ptBR}
              modifiers={{
                hasEvent: (date) =>
                  diasComAgendamento.has(format(date, 'yyyy-MM-dd')),
              }}
              modifiersClassNames={{
                hasEvent:
                  'relative after:absolute after:bottom-1 after:size-1 after:rounded-full after:bg-primary',
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {format(diaSelecionado, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
            {loading && <SkeletonLoader type="list" count={5} />}
            {!loading && agendamentosDoDia.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground gap-2">
                <CalendarX className="size-10 opacity-40" />
                <p className="text-sm">Nenhum agendamento neste dia.</p>
                <Button variant="outline" size="sm" onClick={abrirNovo} className="h-8 mt-1">
                  <Plus className="size-3.5" /> Criar agendamento
                </Button>
              </div>
            )}
            {agendamentosDoDia.map((a) => (
              <CardAgendamento
                key={a.id}
                agendamento={a}
                onEditar={() => abrirEdicao(a)}
                onExcluir={() =>
                  setConfirmExcluir({
                    id: a.id,
                    titulo: `${format(parseISO(a.dataHora), 'HH:mm')} — ${
                      a.pet?.nome || 'pet'
                    }`,
                  })
                }
                onConfirmar={() =>
                  mudarStatus(a.id, 'confirmado', 'Agendamento confirmado')
                }
                onConcluir={() =>
                  mudarStatus(a.id, 'concluido', 'Agendamento concluído')
                }
                onCancelar={() =>
                  mudarStatus(a.id, 'cancelado', 'Agendamento cancelado')
                }
                onReagendar={() => abrirReagendar(a)}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Próximos agendamentos por período */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              Próximos agendamentos
            </h2>
            <p className="text-xs text-muted-foreground">
              {agendamentosDoPeriodo.length} no período selecionado
            </p>
          </div>
          <Select
            value={periodo}
            onValueChange={(v) => setPeriodo(v as PeriodoFiltro)}
          >
            <SelectTrigger className="w-full sm:w-[200px] h-9">
              <CalendarDays className="size-3.5 mr-1 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODO_FILTRO.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <SkeletonLoader type="list" count={4} />
        ) : agendamentosDoPeriodo.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground gap-2 border border-dashed border-border rounded-xl">
            <CalendarX className="size-10 opacity-40" />
            <p className="text-sm">Nenhum agendamento neste período.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agendamentosDoPeriodo
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.dataHora).getTime() -
                  new Date(b.dataHora).getTime()
              )
              .map((a) => (
                <CardAgendamento
                  key={a.id}
                  agendamento={a}
                  onEditar={() => abrirEdicao(a)}
                  onExcluir={() =>
                    setConfirmExcluir({
                      id: a.id,
                      titulo: `${format(parseISO(a.dataHora), 'HH:mm')} — ${
                        a.pet?.nome || 'pet'
                      }`,
                    })
                  }
                  onConfirmar={() =>
                    mudarStatus(a.id, 'confirmado', 'Agendamento confirmado')
                  }
                  onConcluir={() =>
                    mudarStatus(a.id, 'concluido', 'Agendamento concluído')
                  }
                  onCancelar={() =>
                    mudarStatus(a.id, 'cancelado', 'Agendamento cancelado')
                  }
                  onReagendar={() => abrirReagendar(a)}
                />
              ))}
          </div>
        )}
      </div>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {editando ? 'Editar agendamento' : 'Novo agendamento'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Preencha os dados do atendimento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pet">Pet</Label>
              <Select
                value={form.petId}
                onValueChange={(v) => setForm({ ...form, petId: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o pet" />
                </SelectTrigger>
                <SelectContent>
                  {pets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} — {p.cliente?.nome || 'sem dono'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="servico">Serviço</Label>
              <Input
                id="servico"
                placeholder="Banho, tosa, spa..."
                value={form.servico}
                onChange={(e) => setForm({ ...form, servico: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dataHora">Data e hora</Label>
              <Input
                id="dataHora"
                type="datetime-local"
                value={form.dataHora}
                onChange={(e) =>
                  setForm({ ...form, dataHora: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as StatusAgendamento })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agendado">Agendado</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                rows={3}
                value={form.observacoes}
                onChange={(e) =>
                  setForm({ ...form, observacoes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={salvar} className="h-10 w-full sm:w-auto">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog reagendar */}
      <Dialog open={reagendarOpen} onOpenChange={setReagendarOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <CalendarClock className="size-5 text-primary" />
              Reagendar
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {reagendarAlvo?.pet?.nome} — {reagendarAlvo?.servico}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="reagendar-data">Nova data e hora</Label>
              <Input
                id="reagendar-data"
                type="datetime-local"
                value={reagendarDataHora}
                onChange={(e) => setReagendarDataHora(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReagendarOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button onClick={salvarReagendar} className="w-full sm:w-auto">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <ConfirmDialog
        open={!!confirmExcluir}
        onOpenChange={(o) => !o && setConfirmExcluir(null)}
        title="Excluir agendamento?"
        description={
          confirmExcluir
            ? `Excluir o agendamento "${confirmExcluir.titulo}"? Esta ação não pode ser desfeita.`
            : 'Esta ação não pode ser desfeita.'
        }
        confirmText="Excluir"
        variant="destructive"
        onConfirm={async () => {
          if (confirmExcluir) await excluir(confirmExcluir.id)
        }}
      />
    </div>
  )
}
