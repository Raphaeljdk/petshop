'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CreditCard,
  QrCode as QrCodeIcon,
  Barcode,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  Receipt,
  Filter,
  Search,
  X,
  User,
  Tag,
  Wand2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type {
  ConfiguracaoPagamento,
  MetodoPagamento,
  StatusMercadoPago,
  Venda,
} from '@/lib/types'

interface PagamentosViewProps {
  refreshSignal?: number
}

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_META: Record<
  string,
  { label: string; cor: string; dot: string; icon: React.ComponentType<{ className?: string }> }
> = {
  approved: {
    label: 'Aprovado',
    cor: 'bg-green-100 text-green-800 border-green-200',
    dot: 'bg-green-500',
    icon: CheckCircle2,
  },
  authorized: {
    label: 'Autorizado',
    cor: 'bg-green-100 text-green-800 border-green-200',
    dot: 'bg-green-500',
    icon: CheckCircle2,
  },
  pending: {
    label: 'Pendente',
    cor: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    icon: Clock,
  },
  in_process: {
    label: 'Em processamento',
    cor: 'bg-sky-100 text-sky-800 border-sky-200',
    dot: 'bg-sky-500',
    icon: Clock,
  },
  in_mediation: {
    label: 'Em mediação',
    cor: 'bg-purple-100 text-purple-800 border-purple-200',
    dot: 'bg-purple-500',
    icon: ShieldCheck,
  },
  rejected: {
    label: 'Rejeitado',
    cor: 'bg-red-100 text-red-800 border-red-200',
    dot: 'bg-red-500',
    icon: XCircle,
  },
  cancelled: {
    label: 'Cancelado',
    cor: 'bg-zinc-100 text-zinc-800 border-zinc-200',
    dot: 'bg-zinc-500',
    icon: XCircle,
  },
}

const METODO_ICON: Record<MetodoPagamento, React.ComponentType<{ className?: string }>> = {
  pix: QrCodeIcon,
  cartao: CreditCard,
  boleto: Barcode,
}

function mascaraToken(token: string | null | undefined): string {
  if (!token) return ''
  if (token.length <= 12) return token
  return `${token.slice(0, 6)}${'•'.repeat(8)}${token.slice(-4)}`
}

export function PagamentosView({ refreshSignal }: PagamentosViewProps) {
  const [config, setConfig] = useState<ConfiguracaoPagamento | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [mostrarToken, setMostrarToken] = useState(false)
  const [mostrarPublicKey, setMostrarPublicKey] = useState(false)
  const [formToken, setFormToken] = useState('')
  const [formPublicKey, setFormPublicKey] = useState('')

  // Vendas com pagamento
  const [vendas, setVendas] = useState<Venda[]>([])
  const [loadingVendas, setLoadingVendas] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const carregarConfig = async () => {
    try {
      const res = await fetch('/api/pagamento/config', { credentials: 'same-origin' })
      if (res.ok) {
        const data: ConfiguracaoPagamento = await res.json()
        setConfig(data)
        setFormToken('')
        setFormPublicKey('')
      }
    } catch (e) {
      console.error('[PagamentosView] carregarConfig erro:', e)
    } finally {
      setLoadingConfig(false)
    }
  }

  const carregarVendas = async () => {
    try {
      const res = await fetch('/api/vendas', { credentials: 'same-origin' })
      if (res.ok) {
        const data: Venda[] = await res.json()
        // Apenas vendas que passaram pelo fluxo de pagamento (têm mercadoPagoId)
        const comPagamento = data.filter((v) => v.mercadoPagoId)
        setVendas(comPagamento)
      }
    } catch (e) {
      console.error('[PagamentosView] carregarVendas erro:', e)
    } finally {
      setLoadingVendas(false)
    }
  }

  useEffect(() => {
    carregarConfig()
    carregarVendas()
  }, [])

  useEffect(() => {
    if (refreshSignal && refreshSignal > 0) {
      carregarVendas()
    }
  }, [refreshSignal])

  const salvarConfig = async () => {
    setSalvandoConfig(true)
    try {
      const body: Record<string, unknown> = {}
      if (config) {
        body.mercadoPagoAtivo = config.mercadoPagoAtivo
        body.mercadoPagoSandbox = config.mercadoPagoSandbox
        body.pixAtivo = config.pixAtivo
        body.cartaoAtivo = config.cartaoAtivo
        body.boletoAtivo = config.boletoAtivo
      }
      if (formToken.trim()) body.mercadoPagoAccessToken = formToken.trim()
      if (formPublicKey.trim()) body.mercadoPagoPublicKey = formPublicKey.trim()

      const res = await fetch('/api/pagamento/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Erro ao salvar')
      }
      toast.success('Configurações salvas com sucesso!')
      setFormToken('')
      setFormPublicKey('')
      carregarConfig()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar configurações')
    } finally {
      setSalvandoConfig(false)
    }
  }

  const toggleConfig = (campo: keyof ConfiguracaoPagamento, valor: boolean) => {
    setConfig((prev) => (prev ? { ...prev, [campo]: valor } : prev))
  }

  const vendasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return vendas.filter((v) => {
      if (filtroStatus !== 'todos') {
        const status = (v.mercadoPagoStatus || 'pending') as string
        if (status !== filtroStatus) return false
      }
      if (termo) {
        const nome = v.cliente?.nome?.toLowerCase() || ''
        const id = v.id.toLowerCase()
        const mpId = v.mercadoPagoId?.toLowerCase() || ''
        if (!nome.includes(termo) && !id.includes(termo) && !mpId.includes(termo)) {
          return false
        }
      }
      return true
    })
  }, [vendas, busca, filtroStatus])

  const stats = useMemo(() => {
    const s = {
      aprovado: 0,
      pendente: 0,
      rejeitado: 0,
      total: vendas.length,
      faturado: 0,
    }
    for (const v of vendas) {
      const status = (v.mercadoPagoStatus || 'pending') as string
      if (status === 'approved' || status === 'authorized') {
        s.aprovado++
        s.faturado += v.total
      } else if (status === 'rejected' || status === 'cancelled') {
        s.rejeitado++
      } else {
        s.pendente++
      }
    }
    return s
  }, [vendas])

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="size-6 text-primary" />
          Pagamentos
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Configuração do Mercado Pago e histórico de vendas pagas online
        </p>
      </div>

      {/* Card 1: Configuração do Mercado Pago */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 flex-wrap text-base sm:text-lg">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Configuração do Mercado Pago
            </span>
            {config && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px]',
                  (config.checkoutPronto ?? config.mercadoPagoAtivo)
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : 'border-amber-300 bg-amber-50 text-amber-700'
                )}
              >
                {(config.checkoutPronto ?? config.mercadoPagoAtivo) ? (
                  <>
                    <CheckCircle2 className="size-3 mr-1" /> Pronto
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-3 mr-1" /> Configuração incompleta
                  </>
                )}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingConfig ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : config ? (
            <>
              {config.checkoutPronto === false && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="size-4" />
                    Checkout Transparente ainda não está pronto
                  </p>
                  <p>
                    Access Token: {config.accessTokenConfigurado ? 'configurado' : 'faltando'} · Public Key:{' '}
                    {config.publicKeyConfigurada ? 'configurada' : 'faltando'}.
                  </p>
                  {!config.webhookSecretConfigurado && (
                    <p>
                      O segredo do webhook também está pendente para confirmação automática dos pagamentos.
                    </p>
                  )}
                </div>
              )}

              {/* Toggle principal */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Ativar Mercado Pago</p>
                  <p className="text-xs text-muted-foreground">
                    Quando desativado, o sistema roda em modo simulado (sem cobrança real)
                  </p>
                </div>
                <Switch
                  checked={config.mercadoPagoAtivo}
                  onCheckedChange={(v) => toggleConfig('mercadoPagoAtivo', v)}
                />
              </div>

              {/* Tokens */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mp-token" className="text-xs">
                    Access Token
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="mp-token"
                      type={mostrarToken ? 'text' : 'password'}
                      placeholder={mascaraToken(config.mercadoPagoAccessToken) || 'TEST-xxxxxxxx...'}
                      value={formToken}
                      onChange={(e) => setFormToken(e.target.value)}
                      className="font-mono text-xs h-9"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-9 shrink-0"
                      onClick={() => setMostrarToken((v) => !v)}
                      aria-label={mostrarToken ? 'Ocultar token' : 'Mostrar token'}
                    >
                      {mostrarToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Token de produção: APP_USR-... · Token de teste: TEST-...
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mp-public-key" className="text-xs">
                    Public Key
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="mp-public-key"
                      type={mostrarPublicKey ? 'text' : 'password'}
                      placeholder={mascaraToken(config.mercadoPagoPublicKey) || 'TEST-xxxxxxxx-xxxx-...'}
                      value={formPublicKey}
                      onChange={(e) => setFormPublicKey(e.target.value)}
                      className="font-mono text-xs h-9"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-9 shrink-0"
                      onClick={() => setMostrarPublicKey((v) => !v)}
                      aria-label={mostrarPublicKey ? 'Ocultar' : 'Mostrar'}
                    >
                      {mostrarPublicKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Chave pública do Mercado Pago (front-end)
                  </p>
                </div>
              </div>

              {/* Sandbox toggle */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Wand2 className="size-4 text-amber-500" />
                    Modo Sandbox (teste)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Usa credenciais de teste do Mercado Pago
                  </p>
                </div>
                <Switch
                  checked={config.mercadoPagoSandbox}
                  onCheckedChange={(v) => toggleConfig('mercadoPagoSandbox', v)}
                />
              </div>

              {/* Métodos ativos */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Métodos de pagamento aceitos
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <MetodoToggle
                    label="PIX"
                    icon={QrCodeIcon}
                    checked={config.pixAtivo}
                    onToggle={(v) => toggleConfig('pixAtivo', v)}
                  />
                  <MetodoToggle
                    label="Cartão de crédito"
                    icon={CreditCard}
                    checked={config.cartaoAtivo}
                    onToggle={(v) => toggleConfig('cartaoAtivo', v)}
                  />
                  <MetodoToggle
                    label="Boleto"
                    icon={Barcode}
                    checked={config.boletoAtivo}
                    onToggle={(v) => toggleConfig('boletoAtivo', v)}
                  />
                </div>
              </div>

              <Button
                className="w-full btn-brand h-11"
                disabled={salvandoConfig}
                onClick={salvarConfig}
              >
                {salvandoConfig ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <Save className="size-4" /> Salvar configurações
                  </>
                )}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as configurações.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Card 2: Vendas com pagamento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Receipt className="size-5 text-primary" />
            Vendas com pagamento online
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KPI
              label="Aprovadas"
              value={stats.aprovado.toString()}
              icon={CheckCircle2}
              color="text-green-600 bg-green-100"
            />
            <KPI
              label="Pendentes"
              value={stats.pendente.toString()}
              icon={Clock}
              color="text-amber-600 bg-amber-100"
            />
            <KPI
              label="Rejeitadas"
              value={stats.rejeitado.toString()}
              icon={XCircle}
              color="text-red-600 bg-red-100"
            />
            <KPI
              label="Faturado"
              value={fmtMoeda(stats.faturado)}
              icon={Tag}
              color="text-primary bg-primary/10"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Buscar por cliente, ID da venda ou ID MP..."
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
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="in_process">Em processamento</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lista */}
          {loadingVendas && <SkeletonLoader type="cards" count={3} />}

          {!loadingVendas && vendasFiltradas.length === 0 && (
            <div className="text-center py-8">
              <Receipt className="size-12 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {vendas.length === 0
                  ? 'Nenhuma venda paga online ainda.'
                  : 'Nenhuma venda encontrada com os filtros aplicados.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-96 overflow-y-auto custom-scrollbar pr-1">
            {vendasFiltradas.map((v) => {
              const status = (v.mercadoPagoStatus || 'pending') as StatusMercadoPago
              const meta = STATUS_META[status] || STATUS_META.pending
              const StatusIcon = meta.icon
              const ehSimulado =
                !v.mercadoPagoId ||
                v.mercadoPagoId.startsWith('SIM_') ||
                v.mercadoPagoId.startsWith('SIM-')

              return (
                <Card key={v.id} className="card-hover">
                  <CardContent className="p-3 sm:p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">
                          Pedido #{v.id.slice(-8).toUpperCase()}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(parseISO(v.createdAt), "dd/MM/yyyy 'às' HH:mm", {
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
                        <StatusIcon className="size-3" />
                        {meta.label}
                      </Badge>
                    </div>

                    {/* Cliente */}
                    <div className="flex items-center gap-2 text-xs">
                      <User className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">
                        {v.cliente?.nome || 'Cliente não vinculado'}
                      </span>
                    </div>

                    {/* MP ID + Método */}
                    <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                      <span className="font-mono text-muted-foreground truncate">
                        {ehSimulado ? (
                          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                            <Wand2 className="size-2.5 mr-1" /> Simulado
                          </Badge>
                        ) : (
                          <>
                            MP:{' '}
                            <span className="font-mono">
                              {v.mercadoPagoId?.slice(0, 16)}...
                            </span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Valor */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">Valor</span>
                      <span className="font-bold text-primary text-sm">
                        {fmtMoeda(v.total)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- Sub-componentes ----------

function MetodoToggle({
  label,
  icon: Icon,
  checked,
  onToggle,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  checked: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-3 rounded-lg border transition-colors',
        checked
          ? 'border-primary bg-primary/5'
          : 'border-border bg-muted/30'
      )}
    >
      <Icon
        className={cn('size-4 shrink-0', checked ? 'text-primary' : 'text-muted-foreground')}
      />
      <span className="text-xs font-medium flex-1 truncate">{label}</span>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  )
}

function KPI({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
      <div className={cn('size-8 rounded-md flex items-center justify-center shrink-0', color)}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight truncate">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
