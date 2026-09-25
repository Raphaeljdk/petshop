'use client'

import { useCallback, useEffect, useState } from 'react'
import { LogOut, Radio, ChevronRight, Menu, Search, Command as CommandIcon } from 'lucide-react'
import { Sidebar, type TabId } from '@/components/layout/Sidebar'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { AgendamentosView } from '@/components/agendamentos/AgendamentosView'
import { EcommerceView } from '@/components/ecommerce/EcommerceView'
import { IntegracoesView } from '@/components/integracoes/IntegracoesView'
import { useTabHistory } from '@/hooks/use-tab-history'
import { NotificacoesView } from '@/components/notificacoes/NotificacoesView'
import { ClientesView } from '@/components/clientes/ClientesView'
import { EntregasView } from '@/components/admin/EntregasView'
import { PagamentosView } from '@/components/admin/PagamentosView'
import { CuponsView } from '@/components/admin/CuponsView'
import { AdminInvitations } from '@/components/admin/AdminInvitations'
import { NotificationBell } from '@/components/admin/NotificationBell'
import { AdminCommandMenu, type AdminCommandAction } from '@/components/admin/AdminCommandMenu'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/Logo'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRealtime } from '@/hooks/use-realtime'
import { toast } from 'sonner'
import type { Notificacao } from '@/lib/types'

function AdminPanelImpl() {
  const { sessao, logout } = useAuth()
  const { tab, setTab } = useTabHistory<TabId>('dashboard')
  const [counts, setCounts] = useState<{
    novo?: number
    andamento?: number
    notificacoesNaoLidas?: number
  }>({})
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [ecommerceRefreshSignal, setEcommerceRefreshSignal] = useState(0)
  const [entregasRefreshSignal, setEntregasRefreshSignal] = useState(0)
  const [pagamentosRefreshSignal, setPagamentosRefreshSignal] = useState(0)
  const [commandOpen, setCommandOpen] = useState(false)

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('ml')
    if (result === 'connected' || result === 'error') setTab('integracoes')
  }, [setTab])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const pageNames: Record<TabId, string> = {
    dashboard: 'Visão geral',
    kanban: 'Kanban de pets',
    agendamentos: 'Agendamentos',
    ecommerce: 'Estoque',
    integracoes: 'Integrações',
    notificacoes: 'Notificações',
    clientes: 'Clientes e pets',
    entregas: 'Entregas',
    pagamentos: 'Pagamentos',
    cupons: 'Cupons e parceiros',
    equipe: 'Equipe e convites',
  }
  const user = sessao.user

  const handleRealtime = useCallback((event: string, data: any) => {
    if (event === 'processo:novo') {
      toast.info(`Novo processo: ${data?.petNome || 'pet'} — ${data?.servico || ''}`)
      setCounts((prev) => ({ ...prev, novo: (prev.novo || 0) + 1 }))
    } else if (event === 'processo:finalizado') {
      toast.success('Processo finalizado e notificações enviadas')
    } else if (event === 'venda:nova') {
      toast.success(`Nova venda: R$ ${(data?.total ?? 0).toFixed(2)}`)
      setEcommerceRefreshSignal((n) => n + 1)
      setEntregasRefreshSignal((n) => n + 1)
      setPagamentosRefreshSignal((n) => n + 1)
    } else if (event === 'pagamento:aprovado') {
      toast.success(`Pagamento aprovado: ${data?.vendaId?.slice(-8).toUpperCase() || ''}`)
      setPagamentosRefreshSignal((n) => n + 1)
      setEcommerceRefreshSignal((n) => n + 1)
    } else if (event === 'pagamento:rejeitado') {
      toast.error(`Pagamento rejeitado: ${data?.vendaId?.slice(-8).toUpperCase() || ''}`)
      setPagamentosRefreshSignal((n) => n + 1)
    } else if (event === 'notificacao:nova') {
      setCounts((prev) => ({
        ...prev,
        notificacoesNaoLidas: (prev.notificacoesNaoLidas || 0) + 1,
      }))
    }
  }, [])

  const { isConnected } = useRealtime([
    { event: 'processo:novo', handler: (d) => handleRealtime('processo:novo', d) },
    { event: 'processo:finalizado', handler: (d) => handleRealtime('processo:finalizado', d) },
    { event: 'venda:nova', handler: (d) => handleRealtime('venda:nova', d) },
    { event: 'pagamento:aprovado', handler: (d) => handleRealtime('pagamento:aprovado', d) },
    { event: 'pagamento:rejeitado', handler: (d) => handleRealtime('pagamento:rejeitado', d) },
    { event: 'notificacao:nova', handler: (d) => handleRealtime('notificacao:nova', d) },
  ])

  const handleNovoAgendamento = useCallback(() => {
    setTab('agendamentos')
    setTimeout(() => window.dispatchEvent(new CustomEvent('agendamentos:novo')), 80)
  }, [setTab])

  const handleNovoProduto = useCallback(() => {
    setTab('ecommerce')
    setTimeout(() => window.dispatchEvent(new CustomEvent('ecommerce:novo-produto')), 80)
  }, [setTab])

  const handleNovaVenda = useCallback(() => {
    setTab('ecommerce')
    setTimeout(() => window.dispatchEvent(new CustomEvent('ecommerce:nova-venda')), 80)
  }, [setTab])

  useEffect(() => {
    const carregar = async () => {
      try {
        const res = await fetch('/api/notificacoes', { credentials: 'same-origin' })
        if (res.ok) {
          const data: Notificacao[] = await res.json()
          const pendentes = data.filter((n) => n.status === 'pendente').length
          setCounts((prev) => ({ ...prev, notificacoesNaoLidas: pendentes }))
        }
      } catch {}
    }
    void carregar()
  }, [tab])

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Sessão encerrada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível sair.')
    }
  }

  if (!user) return null

  return (
    <div className="app-shell flex flex-col bg-background">
      <a className="skip-link" href="#admin-content">Pular para o conteúdo</a>
      <header className="app-header sticky top-0 z-40 border-b border-border">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 h-16 lg:h-18">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" className="lg:hidden shrink-0 size-10" onClick={() => setSidebarOpen(true)} id="admin-menu-trigger" aria-expanded={sidebarOpen} aria-label="Abrir menu">
              <Menu className="size-5" />
            </Button>
            <div className="lg:hidden min-w-0"><Logo size="sm" withText={false} /></div>
            <div className="hidden lg:flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Administração</span>
              <ChevronRight className="size-3.5 text-muted-foreground/60" />
              <span className="font-semibold">{pageNames[tab]}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs">
              <Radio className={`size-3.5 ${isConnected ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
              <span className={isConnected ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                {isConnected ? 'Conectado' : 'Reconectando'}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2.5 border-l border-border pl-3">
              <div className="size-9 rounded-full bg-secondary text-white flex items-center justify-center text-xs font-bold" aria-hidden="true">{user.nome.slice(0, 2).toUpperCase()}</div>
              <div><p className="text-sm font-semibold max-w-40 truncate">{user.nome}</p><p className="text-xs text-muted-foreground">Administrador</p></div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCommandOpen(true)}
              className="admin-command-trigger h-9 gap-2"
              aria-label="Abrir busca rápida"
            >
              <Search className="size-4 sm:hidden" />
              <CommandIcon className="hidden size-4 sm:block" />
              <span className="hidden lg:inline">Buscar ou navegar</span>
              <kbd className="hidden xl:inline-flex rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                Ctrl K
              </kbd>
            </Button>
            <NotificationBell onVerTodas={() => setTab('notificacoes')} />
            <Button variant="outline" size="sm" onClick={handleLogout} aria-label="Sair da conta" className="h-9 sm:h-9">
              <LogOut className="size-4" /><span className="hidden sm:inline ml-1">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar active={tab} onChange={setTab} counts={counts} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
        <main id="admin-content" tabIndex={-1} className="app-main flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          <div className="tab-transition" key={tab}>
            {tab === 'dashboard' && (
              <DashboardView
                onIrParaKanban={() => setTab('kanban')}
                onIrParaAgendamentos={() => setTab('agendamentos')}
                onNovoAgendamento={handleNovoAgendamento}
                onNovoProduto={handleNovoProduto}
                onIrParaEcommerce={() => setTab('ecommerce')}
                onNovaVenda={handleNovaVenda}
                onIrParaNotificacoes={() => setTab('notificacoes')}
                onIrParaClientes={() => setTab('clientes')}
                onIrParaIntegracoes={() => setTab('integracoes')}
                onIrParaEntregas={() => setTab('entregas')}
                onIrParaPagamentos={() => setTab('pagamentos')}
              />
            )}
            {tab === 'kanban' && <KanbanBoard onCountsChange={(c) => setCounts((prev) => ({ ...prev, novo: c.novo, andamento: c.andamento }))} />}
            {tab === 'agendamentos' && <AgendamentosView />}
            {tab === 'ecommerce' && <EcommerceView refreshSignal={ecommerceRefreshSignal} />}
            {tab === 'integracoes' && <IntegracoesView />}
            {tab === 'notificacoes' && <NotificacoesView />}
            {tab === 'clientes' && <ClientesView />}
            {tab === 'equipe' && <AdminInvitations />}
            {tab === 'entregas' && <EntregasView refreshSignal={entregasRefreshSignal} />}
            {tab === 'pagamentos' && <PagamentosView refreshSignal={pagamentosRefreshSignal} />}
            {tab === 'cupons' && <CuponsView />}
          </div>
        </main>
      </div>

      <AdminCommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onNavigate={(nextTab) => setTab(nextTab)}
        onAction={(action: AdminCommandAction) => {
          if (action === 'novo-produto') handleNovoProduto()
          if (action === 'novo-agendamento') handleNovoAgendamento()
          if (action === 'nova-venda') handleNovaVenda()
        }}
      />

      <footer className="hidden sm:block bg-card border-t border-border px-6 py-2">
        <p className="text-xs text-muted-foreground text-center">Matilha Prado · Painel administrativo</p>
      </footer>
    </div>
  )
}

export default function AdminPanel() {
  return <AdminPanelImpl />
}
