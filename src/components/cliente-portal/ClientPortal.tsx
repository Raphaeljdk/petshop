'use client'

import { useState } from 'react'
import { LogOut, ShoppingCart, CalendarClock, Dog, ShoppingBag, Home } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Confetti } from '@/components/brand/Confetti'
import { ClientStore } from '@/components/cliente-portal/ClientStore'
import { ClientHome } from '@/components/cliente-portal/ClientHome'
import { ClientAgendamentos } from '@/components/cliente-portal/ClientAgendamentos'
import { ClientMeusPets } from '@/components/cliente-portal/ClientMeusPets'
import { ClientMinhasCompras } from '@/components/cliente-portal/ClientMinhasCompras'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/components/providers/AuthProvider'
import { useTabHistory } from '@/hooks/use-tab-history'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type TabClient = 'inicio' | 'loja' | 'agendamentos' | 'pets' | 'compras'

const TABS: { id: TabClient; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'loja', label: 'Loja', icon: ShoppingCart },
  { id: 'agendamentos', label: 'Agendamentos', icon: CalendarClock },
  { id: 'pets', label: 'Meus Pets', icon: Dog },
  { id: 'compras', label: 'Minhas Compras', icon: ShoppingBag },
]

export function ClientPortal() {
  const { sessao, logout } = useAuth()
  const { tab, setTab } = useTabHistory<TabClient>('inicio')
  const [confettiTrigger, setConfettiTrigger] = useState(0)

  const user = sessao.user
  const cliente = sessao.cliente

  if (!user) return null

  const nome = user.nome || cliente?.nome || 'Cliente'
  const iniciais = nome
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  const handleLogout = async () => {
    await logout()
    toast.success('Sessão encerrada')
  }

  const onCompraFinalizada = () => {
    setConfettiTrigger((t) => t + 1)
    setTimeout(() => setTab('compras'), 1500)
  }

  return (
    <div className="client-portal flex flex-col min-h-dvh bg-background">
      <a className="skip-link" href="#client-content">Pular para o conteúdo</a>
      <Confetti trigger={confettiTrigger} />

      {/* Header */}
      <header className="app-header sticky top-0 z-40 border-b border-border">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-2">
          <Logo size="sm" />
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="hidden sm:inline text-sm font-medium truncate">
              Olá, <strong className="text-primary">{nome.split(' ')[0]}</strong>
            </span>
            <Avatar className="size-9 sm:size-10">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                {iniciais || 'CL'}
              </AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm" onClick={handleLogout} aria-label="Sair da conta" className="h-9 shrink-0">
              <LogOut className="size-4" />
              <span className="hidden sm:inline ml-1">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav aria-label="Navegação do cliente" className="portal-tabs sticky top-16 sm:top-18 z-30 bg-card border-b border-border">
        <div className="container max-w-7xl mx-auto px-2 sm:px-6">
          <div className="portal-tabs-inner flex gap-2 py-2 overflow-x-auto custom-scrollbar">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'portal-nav-item flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap min-h-11',
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="size-4" />
                  <span className="hidden md:inline">{t.label}</span>
                  <span className="md:hidden">{{ inicio: 'Início', loja: 'Loja', agendamentos: 'Agenda', pets: 'Pets', compras: 'Compras' }[t.id]}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Conteúdo */}
      <main id="client-content" tabIndex={-1} className="flex-1 w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="tab-transition" key={tab}>
          {tab === 'inicio' && (
            <ClientHome
              onIrParaLoja={() => setTab('loja')}
              onIrParaAgendamentos={() => setTab('agendamentos')}
              onIrParaPets={() => setTab('pets')}
              onIrParaCompras={() => setTab('compras')}
            />
          )}
          {tab === 'loja' && <ClientStore onCompraFinalizada={onCompraFinalizada} />}
          {tab === 'agendamentos' && <ClientAgendamentos />}
          {tab === 'pets' && <ClientMeusPets />}
          {tab === 'compras' && <ClientMinhasCompras />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="container max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center">
          <Logo size="sm" withText />
          <p className="text-xs text-muted-foreground">
            Matilha Prado — Plataforma de Pet Shop
          </p>
        </div>
      </footer>
    </div>
  )
}
