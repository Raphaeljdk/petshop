'use client'

import type { ComponentType } from 'react'
import {
  Activity,
  CalendarClock,
  CreditCard,
  LayoutDashboard,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Truck,
  UsersRound,
  Plug,
} from 'lucide-react'
import type { TabId } from '@/components/layout/Sidebar'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'

export type AdminCommandAction = 'novo-produto' | 'novo-agendamento' | 'nova-venda'

type AdminCommandMenuProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (tab: TabId) => void
  onAction: (action: AdminCommandAction) => void
}

const navigation: Array<{
  id: TabId
  label: string
  icon: ComponentType<{ className?: string }>
  keywords: string
}> = [
  { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard, keywords: 'dashboard início indicadores' },
  { id: 'kanban', label: 'Kanban de pets', icon: Activity, keywords: 'atendimentos processos pets' },
  { id: 'agendamentos', label: 'Agendamentos', icon: CalendarClock, keywords: 'agenda horários serviços' },
  { id: 'clientes', label: 'Clientes e pets', icon: UsersRound, keywords: 'clientes tutores animais' },
  { id: 'ecommerce', label: 'Produtos e estoque', icon: Package, keywords: 'loja produtos estoque catálogo' },
  { id: 'entregas', label: 'Entregas', icon: Truck, keywords: 'frete pedidos envios' },
  { id: 'pagamentos', label: 'Pagamentos', icon: CreditCard, keywords: 'mercado pago pix cartão vendas' },
  { id: 'integracoes', label: 'Integrações', icon: Plug, keywords: 'zetta mercado livre api' },
]

export function AdminCommandMenu({
  open,
  onOpenChange,
  onNavigate,
  onAction,
}: AdminCommandMenuProps) {
  const navigate = (tab: TabId) => {
    onOpenChange(false)
    onNavigate(tab)
  }

  const action = (value: AdminCommandAction) => {
    onOpenChange(false)
    onAction(value)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Busca rápida do painel"
      description="Navegue entre áreas e execute ações administrativas."
      className="sm:max-w-xl"
    >
      <CommandInput placeholder="Buscar página ou ação..." />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
            <Search className="size-5" />
            Nenhum resultado encontrado.
          </div>
        </CommandEmpty>

        <CommandGroup heading="Navegação">
          {navigation.map((item, index) => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.keywords}`}
                onSelect={() => navigate(item.id)}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
                {index < 5 && <CommandShortcut>{index + 1}</CommandShortcut>}
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações rápidas">
          <CommandItem value="novo produto cadastrar produto" onSelect={() => action('novo-produto')}>
            <Plus className="size-4" />
            Novo produto
          </CommandItem>
          <CommandItem value="novo agendamento criar agenda" onSelect={() => action('novo-agendamento')}>
            <CalendarClock className="size-4" />
            Novo agendamento
          </CommandItem>
          <CommandItem value="nova venda registrar venda" onSelect={() => action('nova-venda')}>
            <ShoppingCart className="size-4" />
            Registrar venda
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
