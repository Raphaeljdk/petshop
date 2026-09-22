'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Dog,
  Link2,
  Package,
  Plug,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
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

export function DashboardView({
  onIrParaKanban,
  onIrParaAgendamentos,
  onIrParaEcommerce,
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

    async function carregar() {
      try {
        const res = await fetch('/api/dashboard', {
          credentials: 'same-origin',
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('Falha ao carregar o painel')
        const data = await res.json()
        if (active) {
          setStats(data)
          setError(false)
        }
      } catch (e) {
        console.error('dashboard erro:', e)
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void carregar()
    const timer = setInterval(() => void carregar(), 30000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [retry])

  if (loading && !stats) {
    return <SkeletonLoader type="dashboard" />
  }

  if (error && !stats) {
    return (
      <Card>
        <CardContent className="space-y-4 py-8 text-center">
          <AlertTriangle className="mx-auto size-8 text-primary" />
          <h1 className="text-xl font-semibold">Não foi possível consultar o painel</h1>
          <p className="text-sm text-muted-foreground">
            Verifique a bridge Oracle e tente novamente.
          </p>
          <Button
            onClick={() => {
              setLoading(true)
              setError(false)
              setRetry((value) => value + 1)
            }}
          >
            <RefreshCw className="size-4" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  const zetta = stats?.zetta
  const metricas = [
    {
      label: 'Clientes Zetta',
      valor: zetta?.clientes ?? stats?.totalClientes ?? 0,
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
      onClick: onIrParaClientes,
    },
    {
      label: 'Pets Zetta',
      valor: zetta?.pets ?? stats?.totalPets ?? 0,
      icon: Dog,
      color: 'text-orange-600 bg-orange-50',
      onClick: onIrParaClientes,
    },
    {
      label: 'Produtos Zetta',
      valor: zetta?.produtos ?? stats?.totalProdutos ?? 0,
      icon: Package,
      color: 'text-purple-600 bg-purple-50',
      onClick: onIrParaEcommerce,
    },
    {
      label: 'Atendimentos Zetta',
      valor: zetta?.atendimentos ?? 0,
      icon: Activity,
      color: 'text-amber-600 bg-amber-50',
      onClick: onIrParaKanban,
    },
    {
      label: 'Contas do portal',
      valor: zetta?.contasPortal ?? 0,
      icon: ShieldCheck,
      color: 'text-cyan-600 bg-cyan-50',
      onClick: onIrParaClientes,
    },
    {
      label: 'Portal vinculado',
      valor: zetta?.contasVinculadas ?? 0,
      icon: Link2,
      color: 'text-green-600 bg-green-50',
      onClick: onIrParaClientes,
    },
  ]

  const atalhos = [
    {
      label: 'Clientes e pets',
      icon: Users,
      onClick: onIrParaClientes,
      className: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Atendimentos',
      icon: Activity,
      onClick: onIrParaKanban,
      className: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Agendamentos',
      icon: CalendarClock,
      onClick: onIrParaAgendamentos,
      className: 'text-cyan-600 bg-cyan-50',
    },
    {
      label: 'Produtos / estoque',
      icon: Package,
      onClick: onIrParaEcommerce,
      className: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Integrações',
      icon: Plug,
      onClick: onIrParaIntegracoes,
      className: 'text-indigo-600 bg-indigo-50',
    },
    {
      label: 'Entregas',
      icon: Truck,
      onClick: onIrParaEntregas,
      className: 'text-sky-600 bg-sky-50',
    },
    {
      label: 'Pagamentos',
      icon: ShoppingCart,
      onClick: onIrParaPagamentos,
      className: 'text-emerald-600 bg-emerald-50',
    },
  ] as const

  return (
    <div className="dashboard-view space-y-5 sm:space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow text-primary !mb-2 !mt-0">Sua matilha, em dia</p>
          <h1 className="font-bold">Visão geral</h1>
          <p>
            Dados operacionais oficiais do Siggma/Zetta. O Hub Matilha Prado funciona como camada de gestão e acesso.
          </p>
        </div>
        <Badge
          variant={zetta?.online ? 'default' : 'secondary'}
          className="h-9 px-3 text-sm"
        >
          {zetta?.online ? (
            <>
              <CheckCircle2 className="size-4" /> Zetta online
            </>
          ) : (
            <>
              <AlertTriangle className="size-4" /> Zetta indisponível
            </>
          )}
        </Badge>
      </div>

      {error && (
        <p role="status" className="text-sm text-muted-foreground">
          Não foi possível atualizar agora. Exibindo os dados da última consulta.
        </p>
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex gap-3 p-4 sm:p-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">Zetta como fonte única de dados</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Clientes, pets, produtos e atendimentos exibidos no painel são lidos do ERP. O Hub mantém autenticação, portal, pagamentos e a interface administrativa, sem criar cadastros paralelos. Operações de escrita no ERP serão liberadas conforme os endpoints oficiais da Zetta forem disponibilizados.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="stagger-grid grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
        {metricas.map((metrica) => {
          const Icon = metrica.icon
          return (
            <button
              key={metrica.label}
              type="button"
              onClick={metrica.onClick}
              disabled={!metrica.onClick}
              className="text-left"
            >
              <Card className="metric-card card-hover h-full py-0">
                <CardContent className="flex flex-row items-center justify-between gap-3 p-4 sm:p-5">
                  <div className={cn('flex size-10 items-center justify-center rounded-xl', metrica.color)}>
                    <Icon className="size-4 sm:size-5" />
                  </div>
                  <div className="text-right">
                    <p className="metric-value">{loading ? '—' : metrica.valor}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{metrica.label}</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-primary" />
              Últimos atendimentos do Zetta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(zetta?.ultimosAtendimentos?.length ?? 0) === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                Nenhum atendimento retornado pelo ERP.
              </p>
            ) : (
              zetta?.ultimosAtendimentos.map((atendimento) => (
                <div
                  key={String(atendimento.id)}
                  className="flex items-center justify-between gap-3 border-b py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      Atendimento #{atendimento.id}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Cliente {atendimento.clienteId ?? '—'}
                      {atendimento.datahora
                        ? ` · ${new Date(atendimento.datahora).toLocaleString('pt-BR')}`
                        : ''}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {atendimento.status || 'Sem status'}
                  </Badge>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" onClick={onIrParaKanban} disabled={!onIrParaKanban}>
              Ver atendimentos
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plug className="size-4 text-primary" />
              Papel do Hub
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Leitura do Zetta</span>
              <Badge variant={zetta?.online ? 'default' : 'secondary'}>
                {zetta?.online ? 'Online' : 'Verificar'}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Contas do portal</span>
              <strong>{zetta?.contasPortal ?? 0}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Vinculadas ao cliCod</span>
              <strong>{zetta?.contasVinculadas ?? 0}</strong>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Criação/edição de clientes, pets, agendamentos e pedidos no ERP depende dos endpoints oficiais de escrita solicitados à Zetta.
            </div>
            <Button variant="outline" size="sm" onClick={onIrParaIntegracoes} disabled={!onIrParaIntegracoes}>
              Ver integrações
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Acesso rápido</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {atalhos.map((atalho) => {
            const Icon = atalho.icon
            return (
              <Button
                key={atalho.label}
                type="button"
                variant="outline"
                disabled={!atalho.onClick}
                onClick={atalho.onClick}
                className="h-auto min-h-16 justify-start gap-3 rounded-xl bg-card px-3 py-3 text-left"
              >
                <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', atalho.className)}>
                  <Icon className="size-4" />
                </div>
                <span className="text-sm font-medium">{atalho.label}</span>
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
