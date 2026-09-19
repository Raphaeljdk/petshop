'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Truck,
  Package,
  MapPin,
  Search,
  Filter,
  X,
  PackageCheck,
  CheckCircle2,
  CircleDot,
  Send,
  Tag,
  Clock,
  User,
  Phone,
  MapPinned,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { ExportButton } from '@/components/ui/ExportButton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Venda, StatusEntrega, TipoEntrega } from '@/lib/types'

interface EntregasViewProps {
  refreshSignal?: number
}

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_META: Record<
  StatusEntrega,
  { label: string; cor: string; dot: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pendente: {
    label: 'Pendente',
    cor: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    icon: Clock,
  },
  enviada: {
    label: 'Enviada',
    cor: 'bg-sky-100 text-sky-800 border-sky-200',
    dot: 'bg-sky-500',
    icon: Send,
  },
  entregue: {
    label: 'Entregue',
    cor: 'bg-green-100 text-green-800 border-green-200',
    dot: 'bg-green-500',
    icon: CheckCircle2,
  },
  cancelada: {
    label: 'Cancelada',
    cor: 'bg-red-100 text-red-800 border-red-200',
    dot: 'bg-red-500',
    icon: X,
  },
}

const TIPO_META: Record<TipoEntrega, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  retirada: { label: 'Retirada na loja', icon: PackageCheck },
  entrega_propria: { label: 'Motoboy', icon: Truck },
  sedex: { label: 'Sedex (legado)', icon: Package },
}

const FLUXO_STATUS: StatusEntrega[] = ['pendente', 'enviada', 'entregue']

function proximoStatus(status: StatusEntrega): StatusEntrega | null {
  const idx = FLUXO_STATUS.indexOf(status)
  if (idx < 0 || idx === FLUXO_STATUS.length - 1) return null
  return FLUXO_STATUS[idx + 1]
}

export function EntregasView({ refreshSignal }: EntregasViewProps) {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [editandoRastreio, setEditandoRastreio] = useState<Record<string, string>>({})
  const [salvandoRastreio, setSalvandoRastreio] = useState<Record<string, boolean>>({})
  const [atualizandoStatus, setAtualizandoStatus] = useState<Record<string, boolean>>({})

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/vendas', { credentials: 'same-origin' })
      if (res.ok) {
        const data: Venda[] = await res.json()
        // Apenas vendas com entrega (exclui retirada e sem tipo)
        const apenasEntregas = data.filter(
          (v) => v.tipoEntrega && v.tipoEntrega !== 'retirada'
        )
        setVendas(apenasEntregas)
      }
    } catch (e) {
      console.error('entregas carregar erro:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar, refreshSignal])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return vendas.filter((v) => {
      if (filtroTipo !== 'todos' && v.tipoEntrega !== filtroTipo) return false
      if (filtroStatus !== 'todos' && (v.statusEntrega || 'pendente') !== filtroStatus)
        return false
      if (termo) {
        const nome = v.cliente?.nome?.toLowerCase() || ''
        const telefone = v.cliente?.telefone?.toLowerCase() || ''
        const cep = v.cepEntrega?.toLowerCase() || ''
        const rastreio = v.codigoRastreio?.toLowerCase() || ''
        const id = v.id.toLowerCase()
        if (
          !nome.includes(termo) &&
          !telefone.includes(termo) &&
          !cep.includes(termo) &&
          !rastreio.includes(termo) &&
          !id.includes(termo)
        ) {
          return false
        }
      }
      return true
    })
  }, [vendas, busca, filtroTipo, filtroStatus])

  const temFiltrosAtivos =
    busca.trim() !== '' || filtroTipo !== 'todos' || filtroStatus !== 'todos'

  const limparFiltros = () => {
    setBusca('')
    setFiltroTipo('todos')
    setFiltroStatus('todos')
  }

  const atualizarStatus = async (vendaId: string, statusAtual: StatusEntrega) => {
    const prox = proximoStatus(statusAtual)
    if (!prox) {
      toast.info('Entrega já concluída')
      return
    }
    setAtualizandoStatus((p) => ({ ...p, [vendaId]: true }))
    try {
      const res = await fetch(`/api/vendas/${vendaId}/entrega`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ statusEntrega: prox }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Erro ao atualizar status')
      }
      const atualizado: Venda = await res.json()
      setVendas((prev) =>
        prev.map((v) => (v.id === vendaId ? { ...v, ...atualizado } : v))
      )
      toast.success(
        `Status atualizado para "${STATUS_META[prox].label}"`
      )
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar status')
    } finally {
      setAtualizandoStatus((p) => ({ ...p, [vendaId]: false }))
    }
  }

  const salvarRastreio = async (vendaId: string) => {
    const codigo = (editandoRastreio[vendaId] || '').trim()
    if (!codigo) {
      toast.error('Informe o código de rastreio')
      return
    }
    setSalvandoRastreio((p) => ({ ...p, [vendaId]: true }))
    try {
      const res = await fetch(`/api/vendas/${vendaId}/entrega`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ codigoRastreio: codigo }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Erro ao salvar rastreio')
      }
      const atualizado: Venda = await res.json()
      setVendas((prev) =>
        prev.map((v) => (v.id === vendaId ? { ...v, ...atualizado } : v))
      )
      setEditandoRastreio((p) => {
        const novo = { ...p }
        delete novo[vendaId]
        return novo
      })
      // Se estava pendente e adicionou rastreio, avança para "enviada" automaticamente
      if (atualizado.statusEntrega === 'pendente') {
        await atualizarStatus(vendaId, 'pendente')
      } else {
        toast.success('Código de rastreio salvo')
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar rastreio')
    } finally {
      setSalvandoRastreio((p) => ({ ...p, [vendaId]: false }))
    }
  }

  // Estatísticas rápidas
  const stats = useMemo(() => {
    const s = { pendente: 0, enviada: 0, entregue: 0, total: vendas.length }
    for (const v of vendas) {
      const st = (v.statusEntrega || 'pendente') as StatusEntrega
      if (st === 'pendente') s.pendente++
      else if (st === 'enviada') s.enviada++
      else if (st === 'entregue') s.entregue++
    }
    return s
  }, [vendas])

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="size-6 text-primary" />
            Entregas
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Gerencie pedidos com motoboy próprio na Zona Norte
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportButton
            type="entregas"
            label="Exportar CSV"
            variant="outline"
            className="h-9 sm:h-10"
          />
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="size-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight">{stats.pendente}</p>
              <p className="text-[11px] text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="size-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <Send className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight">{stats.enviada}</p>
              <p className="text-[11px] text-muted-foreground">Enviadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="size-9 rounded-lg bg-green-100 text-green-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight">{stats.entregue}</p>
              <p className="text-[11px] text-muted-foreground">Entregues</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Truck className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight">{stats.total}</p>
              <p className="text-[11px] text-muted-foreground">Total entregas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="bg-card/50 border border-border rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Buscar por cliente, telefone, CEP, rastreio ou pedido..."
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
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-full sm:w-[180px] h-9">
              <Filter className="size-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="entrega_propria">Entrega própria</SelectItem>
              <SelectItem value="sedex">Sedex</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-[180px] h-9">
              <CircleDot className="size-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="enviada">Enviada</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {temFiltrosAtivos && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Mostrando {filtradas.length} de {vendas.length} entrega(s)
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

      {/* Lista de entregas */}
      {loading && <SkeletonLoader type="cards" count={4} />}

      {!loading && filtradas.length === 0 && (
        <Card>
          <CardContent className="p-8 sm:p-12 text-center">
            <Truck className="size-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {vendas.length === 0
                ? 'Nenhuma entrega registrada ainda.'
                : 'Nenhuma entrega encontrada com os filtros aplicados.'}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {!loading &&
          filtradas.map((v) => {
            const statusEntrega = (v.statusEntrega || 'pendente') as StatusEntrega
            const meta = STATUS_META[statusEntrega]
            const tipoMeta = v.tipoEntrega
              ? TIPO_META[v.tipoEntrega as TipoEntrega]
              : null
            const TipoIcon = tipoMeta?.icon || Truck
            const StatusIcon = meta.icon
            const prox = proximoStatus(statusEntrega)
            const rastreioEditando = editandoRastreio[v.id] ?? v.codigoRastreio ?? ''
            const isSalvandoRastreio = !!salvandoRastreio[v.id]
            const isAtualizandoStatus = !!atualizandoStatus[v.id]

            return (
              <Card key={v.id} className="card-hover">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm sm:text-base flex items-center gap-2 flex-wrap">
                        <span className="truncate">
                          Pedido #{v.id.slice(-8).toUpperCase()}
                        </span>
                        {tipoMeta && (
                          <Badge
                            variant="outline"
                            className="text-[10px] flex items-center gap-1 shrink-0"
                          >
                            <TipoIcon className="size-3" />
                            {tipoMeta.label}
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(parseISO(v.createdAt), "dd 'de' MMM 'de' yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        'text-[10px] flex items-center gap-1 shrink-0 border',
                        meta.cor
                      )}
                    >
                      <span className={cn('size-1.5 rounded-full', meta.dot)} />
                      <StatusIcon className="size-3" />
                      {meta.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Cliente */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <User className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">
                        {v.cliente?.nome || 'Cliente não vinculado'}
                      </span>
                    </div>
                    {v.cliente?.telefone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="size-3.5 shrink-0" />
                        <span className="truncate">{v.cliente.telefone}</span>
                      </div>
                    )}
                  </div>

                  {/* Endereço de entrega */}
                  <div className="rounded-md bg-muted/40 p-2.5 space-y-1 text-xs">
                    <div className="flex items-start gap-2">
                      <MapPinned className="size-3.5 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">CEP de entrega</p>
                        <p className="text-muted-foreground font-mono">
                          {v.cepEntrega || '—'}
                        </p>
                      </div>
                    </div>
                    {v.enderecoEntrega && (
                      <div className="flex items-start gap-2">
                        <MapPin className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">Endereço</p>
                          <p className="text-muted-foreground break-words">
                            {v.enderecoEntrega}
                          </p>
                        </div>
                      </div>
                    )}
                    {v.prazoEntrega && (
                      <div className="flex items-center gap-2">
                        <Clock className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">
                          Prazo: <strong className="text-foreground">{v.prazoEntrega}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Resumo financeiro */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Tag className="size-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Frete:</span>
                      <span className="font-semibold">
                        {fmtMoeda(v.valorFrete ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Total pedido:</span>
                      <span className="font-bold text-primary">
                        {fmtMoeda(v.total)}
                      </span>
                    </div>
                  </div>

                  {/* Itens resumidos */}
                  {v.itens && v.itens.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                        {v.itens.length} item(ns) neste pedido
                      </summary>
                      <ul className="mt-1.5 space-y-1 pl-1">
                        {v.itens.map((it) => (
                          <li
                            key={it.id}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="truncate">
                              <Badge variant="outline" className="text-[10px] mr-1">
                                {it.quantidade}x
                              </Badge>
                              {it.produto?.nome || `Produto ${it.produtoId.slice(-6)}`}
                            </span>
                            <span className="text-muted-foreground shrink-0">
                              {fmtMoeda(it.precoUnit * it.quantidade)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Código de rastreio */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`rastreio-${v.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Código de rastreio
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={`rastreio-${v.id}`}
                        placeholder="Ex: ON123456789BR"
                        value={rastreioEditando}
                        onChange={(e) =>
                          setEditandoRastreio((p) => ({
                            ...p,
                            [v.id]: e.target.value,
                          }))
                        }
                        className="h-9 font-mono text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 shrink-0"
                        disabled={isSalvandoRastreio}
                        onClick={() => salvarRastreio(v.id)}
                      >
                        {isSalvandoRastreio ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <>
                            <Tag className="size-3.5" /> Salvar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Ações de status */}
                  <div className="flex items-center gap-2 pt-1 border-t border-border">
                    <Button
                      size="sm"
                      variant={prox === 'enviada' ? 'default' : 'outline'}
                      className="h-8 flex-1"
                      disabled={!prox || isAtualizandoStatus}
                      onClick={() => atualizarStatus(v.id, statusEntrega)}
                    >
                      {isAtualizandoStatus ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <>
                          {prox === 'enviada' && <Send className="size-3.5" />}
                          {prox === 'entregue' && (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          {!prox && <CheckCircle2 className="size-3.5" />}
                          {prox
                            ? `Marcar como ${STATUS_META[prox].label.toLowerCase()}`
                            : 'Concluída'}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
      </div>
    </div>
  )
}
