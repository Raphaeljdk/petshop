'use client'

import { useEffect } from 'react'
import {
  LayoutDashboard,
  CalendarClock,
  Package,
  Plug,
  Bell,
  UsersRound,
  KanbanSquare,
  Truck,
  CreditCard,
  PawPrint,
  ShieldCheck,
  TicketPercent,
} from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'

export type TabId =
  | 'dashboard'
  | 'kanban'
  | 'agendamentos'
  | 'ecommerce'
  | 'integracoes'
  | 'notificacoes'
  | 'clientes'
  | 'entregas'
  | 'pagamentos'
  | 'cupons'
  | 'equipe'

interface SidebarCounts {
  novo?: number
  andamento?: number
  notificacoesNaoLidas?: number
}
interface SidebarProps {
  active: TabId
  onChange: (tab: TabId) => void
  counts?: SidebarCounts
  mobileOpen?: boolean
  onMobileClose?: () => void
}
interface NavItem {
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

function SidebarContent({ active, onChange, counts, onNavigate }: SidebarProps & { onNavigate?: () => void }) {
  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: 'Dia a dia',
      items: [
        { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
        { id: 'kanban', label: 'Kanban de pets', icon: KanbanSquare, badge: counts?.novo },
        { id: 'agendamentos', label: 'Agendamentos', icon: CalendarClock },
        { id: 'clientes', label: 'Clientes e pets', icon: UsersRound },
      ],
    },
    {
      label: 'Loja e vendas',
      items: [
        { id: 'ecommerce', label: 'Estoque', icon: Package },
        { id: 'entregas', label: 'Entregas', icon: Truck },
        { id: 'pagamentos', label: 'Pagamentos', icon: CreditCard },
        { id: 'cupons', label: 'Cupons e parceiros', icon: TicketPercent },
      ],
    },
    {
      label: 'Gerenciamento',
      items: [
        { id: 'equipe', label: 'Equipe e convites', icon: ShieldCheck },
        { id: 'notificacoes', label: 'Notificações', icon: Bell, badge: counts?.notificacoesNaoLidas },
        { id: 'integracoes', label: 'Integrações', icon: Plug },
      ],
    },
  ]

  return (
    <>
      <div className="px-5 pt-7 pb-6 border-b border-white/10">
        <Logo size="md" variant="light" />
        <p className="mt-4 text-xs font-medium text-white/65">Painel administrativo</p>
      </div>
      <nav aria-label="Navegação administrativa" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-5 space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-2 text-xs font-semibold text-white/55 uppercase tracking-wider">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active === item.id ? 'page' : undefined}
                    onClick={() => {
                      onChange(item.id)
                      onNavigate?.()
                    }}
                    className={cn(
                      'sidebar-nav-item w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium min-h-11',
                      active === item.id ? 'text-slate-800' : 'text-white/85'
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {!!item.badge && item.badge > 0 && (
                      <Badge className="bg-orange-100 text-orange-900 text-xs h-5 min-w-5 px-1.5 justify-center">
                        {item.badge}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10">
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex gap-3 items-center">
          <PawPrint className="size-5 text-orange-300 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Nossa matilha</p>
            <p className="text-xs text-white/60">Cuidado em cada detalhe.</p>
          </div>
        </div>
      </div>
    </>
  )
}

export function Sidebar({ active, onChange, counts, mobileOpen = false, onMobileClose }: SidebarProps) {
  useEffect(() => {
    if (!mobileOpen) return
    const media = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => {
      if (media.matches) onMobileClose?.()
    }
    closeOnDesktop()
    media.addEventListener('change', closeOnDesktop)
    return () => media.removeEventListener('change', closeOnDesktop)
  }, [mobileOpen, onMobileClose])

  return (
    <>
      <aside className="sidebar-surface hidden lg:flex flex-col h-full w-64 xl:w-68 shrink-0">
        <SidebarContent active={active} onChange={onChange} counts={counts} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={(open) => { if (!open) onMobileClose?.() }}>
        <SheetContent
          side="left"
          className="sidebar-surface w-72 max-w-[88vw] p-0 gap-0 border-0 [&>button]:text-white"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            document.getElementById('admin-menu-trigger')?.focus()
          }}
        >
          <SheetTitle className="sr-only">Menu administrativo</SheetTitle>
          <SheetDescription className="sr-only">Navegue entre as áreas da Matilha Prado.</SheetDescription>
          <SidebarContent active={active} onChange={onChange} counts={counts} onNavigate={onMobileClose} />
        </SheetContent>
      </Sheet>
    </>
  )
}
