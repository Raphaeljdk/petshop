'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, CalendarDays, Clock, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { addDays, format, isSameDay, parseISO, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { toast } from 'sonner'
import type { Agendamento, StatusAgendamento } from '@/lib/types'

const statusLabel: Record<StatusAgendamento, string> = {
  agendado: 'Novo',
  confirmado: 'Em andamento',
  concluido: 'Finalizado',
  cancelado: 'Cancelado/transferido',
}

const statusClass: Record<StatusAgendamento, string> = {
  agendado: 'bg-blue-100 text-blue-700 border-blue-200',
  confirmado: 'bg-amber-100 text-amber-700 border-amber-200',
  concluido: 'bg-green-100 text-green-700 border-green-200',
  cancelado: 'bg-red-100 text-red-700 border-red-200',
}

type Periodo = 'hoje' | '7dias' | '30dias' | 'todos'

export function AgendamentosView() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<'todos' | StatusAgendamento>('todos')
  const [periodo, setPeriodo] = useState<Periodo>('7dias')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/agendamentos', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível consultar a agenda.')
      setAgendamentos(Array.isArray(payload) ? payload : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao consultar agenda')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const filtrados = useMemo(() => {
    const hoje = startOfDay(new Date())
    const termo = busca.trim().toLowerCase()

    return agendamentos.filter((item) => {
      const data = parseISO(item.dataHora)
      if (periodo === 'hoje' && !isSameDay(data, hoje)) return false
      if (periodo === '7dias' && data > addDays(hoje, 7)) return false
      if (periodo === '30dias' && data > addDays(hoje, 30)) return false
      if (status !== 'todos' && item.status !== status) return false

      if (termo) {
        const texto = [
          item.pet?.nome,
          item.cliente?.nome,
          item.servico,
          item.observacoes,
          item.statusOriginal,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!texto.includes(termo)) return false
      }

      return true
    })
  }, [agendamentos, busca, periodo, status])

  const hojeCount = useMemo(
    () => agendamentos.filter((item) => isSameDay(parseISO(item.dataHora), new Date())).length,
    [agendamentos]
  )
  const novos = useMemo(
    () => agendamentos.filter((item) => item.status === 'agendado').length,
    [agendamentos]
  )
  const andamento = useMemo(
    () => agendamentos.filter((item) => item.status === 'confirmado').length,
    [agendamentos]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda Siggma</h1>
          <p className="text-sm text-muted-foreground">
            Agenda consolidada oficial da unidade, sincronizada por /api/animais-historicos.
          </p>
        </div>
        <Button variant="outline" onClick={() => void carregar()} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex gap-3 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-semibold">Fonte oficial: Siggma</p>
            <p className="mt-1 text-muted-foreground">
              O Hub exibe a agenda em modo de leitura. Criação, alteração, remarcação e cancelamento continuam sendo realizados diretamente no Siggma enquanto a Zetta não disponibilizar escrita oficial no OpenAPI.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Hoje</p><p className="mt-1 text-2xl font-bold">{hojeCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Novos</p><p className="mt-1 text-2xl font-bold">{novos}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Em andamento</p><p className="mt-1 text-2xl font-bold">{andamento}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Futuros carregados</p><p className="mt-1 text-2xl font-bold">{agendamentos.length}</p></CardContent></Card>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_190px_190px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por pet, tutor, serviço..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />
        </div>
        <Select value={periodo} onValueChange={(value) => setPeriodo(value as Periodo)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="7dias">Próximos 7 dias</SelectItem>
            <SelectItem value="30dias">Próximos 30 dias</SelectItem>
            <SelectItem value="todos">Todos os futuros</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => setStatus(value as 'todos' | StatusAgendamento)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="agendado">Novo</SelectItem>
            <SelectItem value="confirmado">Em andamento</SelectItem>
            <SelectItem value="concluido">Finalizado</SelectItem>
            <SelectItem value="cancelado">Cancelado/transferido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <SkeletonLoader type="list" count={6} />
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <CalendarClock className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="font-medium">Nenhum agendamento encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros ou atualize a agenda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtrados.map((item) => {
            const data = parseISO(item.dataHora)
            return (
              <Card key={item.id} className="card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <span className="text-sm font-bold">{format(data, 'dd')}</span>
                        <span className="text-[10px] uppercase">{format(data, 'MMM', { locale: ptBR })}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-semibold">
                          <Clock className="size-3.5" /> {format(data, 'HH:mm')}
                        </p>
                        <p className="mt-1 truncate font-medium">{item.servico}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {item.pet?.nome || 'Pet'} · {item.cliente?.nome || 'Tutor'}
                        </p>
                      </div>
                    </div>
                    <Badge className={`shrink-0 border text-[10px] ${statusClass[item.status]}`}>
                      {item.statusOriginal || statusLabel[item.status]}
                    </Badge>
                  </div>

                  {item.observacoes && (
                    <p className="mt-3 border-l-2 pl-3 text-xs text-muted-foreground">
                      {item.observacoes}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2 border-t pt-3 text-[11px] text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                    {format(data, "EEEE, dd/MM/yyyy", { locale: ptBR })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
