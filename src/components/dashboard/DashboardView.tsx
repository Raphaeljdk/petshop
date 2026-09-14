'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  Dog,
  Package,
  ShoppingCart,
  CalendarClock,
  Activity,
  DollarSign,
  AlertTriangle,
  Clock,
  TrendingUp,
  Bell,
  KanbanSquare,
  Plug,
  Truck,
  Zap,
  CreditCard,
  Plus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DashboardStats } from '@/lib/types'
import { cn } from '@/lib/utils'

interface DashboardViewProps {
  onIrParaKanban?: () => void
  onIrParaAgendamentos?: () => void
  onNovoAgendamento?: () => void
  onNovoProduto?: () => void
  onIrParaEcommerce?: () => void
  onNovaVenda?: () => void
  onIrParaNotificacoes?: () => void
  onIrParaClientes?: () => void
  onIrParaIntegracoes?: () => void
  onIrParaEntregas?: () => void
  onIrParaPagamentos?: () => void
}

// Cores alinhadas às variáveis CSS do tema (laranja/azul/ciano).
const COLORS = {
  primary: 'var(--primary)', // laranja
  secondary: 'var(--secondary)', // azul
  accent: 'var(--accent)', // ciano
}

// Cores fixas por canal de venda (loja=laranja, mercadolivre=amarelo, amazon=azul)
const CANAL_COLORS: Record<string, string> = {
  loja: COLORS.primary,
  mercadolivre: '#f5b800', // amarelo
  amazon: COLORS.secondary,
}

const CANAL_LABELS: Record<string, string> = {
  loja: 'Loja / Site',
  mercadolivre: 'Mercado Livre',
  amazon: 'Amazon',
}

// Paleta para pets por espécie (até 8 fatias)
const PET_COLORS = [
  COLORS.primary,
  COLORS.secondary,
  COLORS.accent,
  '#f5b800',
  '#10b981',
  '#a855f7',
  '#ef4444',
  '#64748b',
]

// Paleta para processos por status
const PROCESSO_STATUS_COLORS: Record<string, string> = {
  novo: COLORS.primary,
  andamento: '#f5b800',
  finalizado: COLORS.secondary,
}

export function DashboardView({
  onIrParaKanban,
  onIrParaAgendamentos,
  onNovoAgendamento,
  onNovoProduto,
  onIrParaEcommerce,
  onNovaVenda,
  onIrParaNotificacoes,
  onIrParaClientes,
  onIrParaIntegracoes,
  onIrParaEntregas,
  onIrParaPagamentos,
}: DashboardViewProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    const carregar = async () => {
      try {
        const res = await fetch('/api/dashboard', { credentials: 'same-origin' })
        if (!res.ok) throw new Error('Falha ao carregar o painel')
        if (res.ok) {
          const data = await res.json()
          if (active) { setStats(data); setError(false) }
        }
      } catch (e) {
        console.error('dashboard erro:', e)
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    carregar()
    const t = setInterval(carregar, 30000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [retry])

  const fmtMoeda = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // Tooltip customizado para formatar moeda em R$
  const MoedaTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-background border border-border rounded-md px-3 py-2 shadow-md text-xs">
        {label && <p className="font-medium mb-1">{label}</p>}
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-foreground">
            <span
              className="inline-block size-2 rounded-sm mr-1.5 align-middle"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>{' '}
            <span className="font-medium tabular-nums">{fmtMoeda(entry.value)}</span>
          </p>
        ))}
      </div>
    )
  }

  // Tooltip genérico para gráficos de quantidade (sem moeda)
  const QuantidadeTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-background border border-border rounded-md px-3 py-2 shadow-md text-xs">
        {label && <p className="font-medium mb-1">{label}</p>}
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-foreground">
            <span
              className="inline-block size-2 rounded-sm mr-1.5 align-middle"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>{' '}
            <span className="font-medium tabular-nums">{entry.value}</span>
          </p>
        ))}
      </div>
    )
  }

  const metricas = [
    {
      label: 'Clientes',
      valor: stats?.totalClientes ?? 0,
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Pets',
      valor: stats?.totalPets ?? 0,
      icon: Dog,
      color: 'text-orange-600 bg-orange-50',
    },
    {
      label: 'Produtos',
      valor: stats?.totalProdutos ?? 0,
      icon: Package,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Vendas',
      valor: stats?.totalVendas ?? 0,
      icon: ShoppingCart,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Agendamentos',
      valor: stats?.totalAgendamentos ?? 0,
      icon: CalendarClock,
      color: 'text-cyan-600 bg-cyan-50',
    },
    {
      label: 'Processos ativos',
      valor: stats?.totalProcessosAndamento ?? 0,
      icon: Activity,
      color: 'text-amber-600 bg-amber-50',
    },
  ]

  /* ---------------------- Quick Actions (Atalhos) ---------------------- */

  const atalhos = [
    {
      label: 'Novo Agendamento',
      icon: CalendarClock,
      iconColor: 'text-cyan-600',
      bgIcon: 'bg-cyan-50',
      onClick: onNovoAgendamento,
    },
    {
      label: 'Novo Produto',
      icon: Package,
      iconColor: 'text-purple-600',
      bgIcon: 'bg-purple-50',
      onClick: onNovoProduto,
    },
    {
      label: 'Ver Kanban',
      icon: KanbanSquare,
      iconColor: 'text-amber-600',
      bgIcon: 'bg-amber-50',
      onClick: onIrParaKanban,
    },
    {
      label: 'Ver Vendas',
      icon: ShoppingCart,
      iconColor: 'text-green-600',
      bgIcon: 'bg-green-50',
      onClick: onIrParaEcommerce,
    },
    {
      label: 'Registrar Venda',
      icon: DollarSign,
      iconColor: 'text-emerald-600',
      bgIcon: 'bg-emerald-50',
      onClick: onNovaVenda,
    },
    {
      label: 'Ver Notificações',
      icon: Bell,
      iconColor: 'text-rose-600',
      bgIcon: 'bg-rose-50',
      onClick: onIrParaNotificacoes,
    },
    {
      label: 'Ver Clientes',
      icon: Users,
      iconColor: 'text-blue-600',
      bgIcon: 'bg-blue-50',
      onClick: onIrParaClientes,
    },
    {
      label: 'Ver Integrações',
      icon: Plug,
      iconColor: 'text-indigo-600',
      bgIcon: 'bg-indigo-50',
      onClick: onIrParaIntegracoes,
    },
    {
      label: 'Ver Entregas',
      icon: Truck,
      iconColor: 'text-cyan-600',
      bgIcon: 'bg-cyan-50',
      onClick: onIrParaEntregas,
    },
    {
      label: 'Ver Pagamentos',
      icon: CreditCard,
      iconColor: 'text-emerald-600',
      bgIcon: 'bg-emerald-50',
      onClick: onIrParaPagamentos,
    },
  ] as const

  // Loading inicial — exibe skeleton em vez do dashboard vazio
  if (loading && !stats) {
    return <SkeletonLoader type="dashboard" />
  }

  if (error && !stats) {
    return <Card><CardContent className="py-8 text-center space-y-4">
      <AlertTriangle className="size-8 text-primary mx-auto" />
      <h1 className="text-xl font-semibold">Não foi possível carregar o painel</h1>
      <p className="text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
      <Button onClick={() => { setLoading(true); setError(false); setRetry(value => value + 1) }}>Tentar novamente</Button>
    </CardContent></Card>
  }

  return (
    <div className="dashboard-view space-y-5 sm:space-y-7">
      <div className="page-heading">
        <div><p className="eyebrow text-primary !mt-0 !mb-2">Sua matilha, em dia</p>
          <h1 className="font-bold">Visão geral</h1>
          <p>Atendimentos, vendas e os próximos passos da sua loja.</p>
        </div>
        <Button onClick={onNovoAgendamento} disabled={!onNovoAgendamento}><Plus className="size-4" /> Novo agendamento</Button>
      </div>
      {error && <p role="status" className="text-sm text-muted-foreground">Não foi possível atualizar. Exibindo os dados da última consulta.</p>}

      <div className="stagger-grid grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4">
        {metricas.map((m) => {
          const Icon = m.icon
          return (
            <Card key={m.label} className="metric-card card-hover py-0">
              <CardContent className="p-4 sm:p-5 flex flex-row items-center justify-between gap-3">
                <div className={`size-10 rounded-xl flex items-center justify-center ${m.color}`}>
                  <Icon className="size-4 sm:size-5" />
                </div>
                <div>
                  <p className="metric-value">
                    {loading ? '—' : m.valor}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{m.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="revenue-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="size-4 text-green-600" />
              Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Hoje</p>
                <p className="text-xl font-bold">
                  {loading ? '—' : fmtMoeda(stats?.faturamentoHoje ?? 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Vendas hoje</p>
                <p className="text-xl font-bold">{stats?.vendasHoje ?? 0}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">No mês</p>
                <p className="text-xl font-bold">
                  {loading ? '—' : fmtMoeda(stats?.faturamentoMes ?? 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Agendamentos hoje</p>
                <p className="text-xl font-bold">{stats?.agendamentosHoje ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-orange-600" />
              Status do Kanban
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              onClick={onIrParaKanban}
              className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-md bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  <Activity className="size-4" />
                </div>
                <span className="text-sm font-medium truncate">Processos ativos</span>
              </div>
              <span className="text-lg font-bold text-amber-700 shrink-0">
                {stats?.totalProcessosAndamento ?? 0}
              </span>
            </button>
            <button
              onClick={onIrParaAgendamentos}
              className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-md bg-cyan-500 text-white flex items-center justify-center shrink-0">
                  <Clock className="size-4" />
                </div>
                <span className="text-sm font-medium truncate">Próximos agendamentos</span>
              </div>
              <span className="text-lg font-bold text-cyan-700 shrink-0">
                {stats?.proximosAgendamentos?.length ?? 0}
              </span>
            </button>
            {(stats?.estoqueBaixo ?? 0) > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="size-5 text-red-600" />
                  <span className="text-sm font-medium">Estoque baixo</span>
                </div>
                <Badge variant="destructive">{stats?.estoqueBaixo}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Atalhos (Quick Actions) */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <Zap className="size-3.5 text-primary" />
          Acesso rápido
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {atalhos.map((a) => {
            const Icon = a.icon
            const hasHandler = !!a.onClick
            return (
              <Button
                key={a.label}
                type="button"
                variant="outline"
                disabled={!hasHandler}
                onClick={a.onClick}
                className={cn(
                  'quick-action group h-auto min-h-16 py-3 px-3 flex flex-row items-center gap-3 bg-card hover:shadow-md hover:border-primary',
                  'border border-border rounded-xl text-left justify-start',
                  !hasHandler && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div
                  className={cn(
                    'size-9 rounded-lg flex items-center justify-center shrink-0',
                    a.bgIcon,
                    a.iconColor,
                    'group-hover:scale-105 transition-transform motion-reduce:transform-none'
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <span className="text-sm font-medium leading-snug">
                  {a.label}
                </span>
              </Button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos processos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats?.ultimosProcessos?.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum processo ainda.</p>
            )}
            {stats?.ultimosProcessos?.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 border-b last:border-0 gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {p.pet?.nome} — {p.servico}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.pet?.cliente?.nome || 'Cliente'}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize shrink-0">
                  {p.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximos agendamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats?.proximosAgendamentos?.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum agendamento.</p>
            )}
            {stats?.proximosAgendamentos?.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between py-2 border-b last:border-0 gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {a.pet?.nome} — {a.servico}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {format(parseISO(a.dataHora), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <Badge variant="secondary" className="capitalize shrink-0">
                  {a.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
