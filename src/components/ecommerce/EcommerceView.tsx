'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownUp,
  Bell,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Filter,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  format,
  formatDistanceToNow,
  isSameDay,
  parseISO,
  subDays,
  startOfDay,
  startOfMonth,
  isWithinInterval,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
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
import { useRealtime } from '@/hooks/use-realtime'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Produto, Venda, StatusVenda, CanalVenda } from '@/lib/types'

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/* --------------------------------------------------------------------- */
/* Helpers de cores                                                      */
/* --------------------------------------------------------------------- */

function corEstoque(qtd: number): { label: string; className: string } {
  if (qtd >= 10) {
    return {
      label: `${qtd} em estoque`,
      className: 'bg-green-100 text-green-700 border-green-200',
    }
  }
  if (qtd >= 5) {
    return {
      label: `${qtd} em estoque`,
      className: 'bg-amber-100 text-amber-700 border-amber-200',
    }
  }
  if (qtd > 0) {
    return {
      label: `Apenas ${qtd}!`,
      className: 'bg-orange-100 text-orange-700 border-orange-200',
    }
  }
  return {
    label: 'Sem estoque',
    className: 'bg-red-100 text-red-700 border-red-200',
  }
}

function emojiCategoria(categoria: string): string {
  const c = (categoria || '').toLowerCase()
  if (c.includes('racao') || c.includes('aliment')) return '🍖'
  if (c.includes('higien') || c.includes('shamp') || c.includes('banho')) return '🧴'
  if (c.includes('brinqued')) return '🧸'
  if (c.includes('acessor') || c.includes('coleira') || c.includes('roupa')) return '🦴'
  if (c.includes('medic') || c.includes('saude')) return '💊'
  if (c.includes('cama') || c.includes('casinha')) return '🏠'
  return '📦'
}

const CANAL_META: Record<CanalVenda, { label: string; badge: string }> = {
  loja: {
    label: 'Loja',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  site: {
    label: 'Site',
    badge: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  mercado_livre: {
    label: 'Mercado Livre',
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
  amazon: {
    label: 'Amazon',
    badge: 'bg-sky-100 text-sky-700 border-sky-200',
  },
}

const STATUS_VENDA_META: Record<StatusVenda, { label: string; badge: string }> = {
  concluida: {
    label: 'Concluída',
    badge: 'bg-green-100 text-green-700 border-green-200',
  },
  pendente: {
    label: 'Pendente',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  cancelada: {
    label: 'Cancelada',
    badge: 'bg-red-100 text-red-700 border-red-200',
  },
}

/* --------------------------------------------------------------------- */
/* StatCard                                                              */
/* --------------------------------------------------------------------- */

function StatCard({
  title,
  value,
  icon: Icon,
  iconClass,
  subtitle,
}: {
  title: string
  value: number | string
  icon: typeof Package
  iconClass: string
  subtitle?: string
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
          <p className="text-lg font-semibold leading-tight truncate">{value}</p>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground truncate">
              {subtitle}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/* --------------------------------------------------------------------- */
/* ProdutoCard                                                            */
/* --------------------------------------------------------------------- */

interface ProdutoCardProps {
  produto: Produto
  onEditar: () => void
  onExcluir: () => void
  onToggleAtivo: () => void
  onQuickEditPreco: (novoPreco: number) => void
  onQuickEditEstoque: (novoEstoque: number) => void
}

function ProdutoCard({
  produto,
  onEditar,
  onExcluir,
  onToggleAtivo,
  onQuickEditPreco,
  onQuickEditEstoque,
}: ProdutoCardProps) {
  const estoqueMeta = corEstoque(produto.estoque)
  const temPromo = produto.precoPromo && produto.precoPromo > 0

  return (
    <Card className={cn('flex flex-col', !produto.ativo && 'opacity-60')}>
      <CardContent className="p-4 flex-1 space-y-3">
        {/* Header do card */}
        <div className="flex items-start gap-3">
          <div className="size-14 rounded-lg bg-muted flex items-center justify-center text-3xl shrink-0">
            {produto.imageUrl ? (
              <img
                src={produto.imageUrl}
                alt={produto.nome}
                className="size-14 object-cover rounded-lg"
              />
            ) : (
              <span aria-hidden>{emojiCategoria(produto.categoria)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-tight truncate">{produto.nome}</p>
            <div className="flex items-center gap-1 flex-wrap mt-1">
              <Badge variant="secondary" className="text-[10px]">
                <Tag className="size-3" />
                {produto.categoria}
              </Badge>
              {produto.zettaProCod && (
                <Badge variant="outline" className="text-[9px]">
                  ERP Zetta #{produto.zettaProCod}
                </Badge>
              )}
              {produto.mlItemId && (
                <Badge className="text-[9px] bg-yellow-100 text-yellow-700 border-yellow-200">
                  ML
                </Badge>
              )}
              {produto.amazonAsin && (
                <Badge className="text-[9px] bg-sky-100 text-sky-700 border-sky-200">
                  Amazon
                </Badge>
              )}
            </div>
          </div>
          <Switch
            checked={produto.ativo}
            onCheckedChange={onToggleAtivo}
            aria-label="Ativar/desativar produto"
          />
        </div>

        {/* SKU + descrição */}
        {produto.sku && (
          <p className="text-[10px] text-muted-foreground">
            SKU: <span className="font-mono">{produto.sku}</span>
          </p>
        )}

        {/* Preço destacado */}
        <div className="flex items-baseline gap-2">
          {temPromo ? (
            <>
              <span className="text-xs line-through text-muted-foreground">
                {fmtMoeda(produto.preco)}
              </span>
              <span className="text-xl font-bold text-primary">
                {fmtMoeda(produto.precoPromo!)}
              </span>
              <Badge className="text-[9px] bg-red-100 text-red-700 border-red-200">
                PROMO
              </Badge>
            </>
          ) : (
            <span className="text-xl font-bold">{fmtMoeda(produto.preco)}</span>
          )}
        </div>

        {/* Estoque */}
        <div className="flex items-center justify-between gap-2">
          <Badge className={cn('text-[10px] border', estoqueMeta.className)}>
            {estoqueMeta.label}
          </Badge>
        </div>

        {/* Quick edit: preço + estoque inline */}
        {produto.zettaProCod ? (
          <div className="rounded-md border border-primary/15 bg-primary/5 p-2 text-[11px] text-muted-foreground">
            Preço e estoque são atualizados pelo ERP Zetta.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
          <div>
            <Label htmlFor={`qpreco-${produto.id}`} className="text-[10px] text-muted-foreground">
              Preço (R$)
            </Label>
            <Input
              id={`qpreco-${produto.id}`}
              type="number"
              step="0.01"
              min="0"
              defaultValue={produto.preco}
              className="h-8 text-xs"
              onBlur={(e) => {
                const novo = Number(e.target.value)
                if (!Number.isNaN(novo) && novo !== produto.preco) {
                  onQuickEditPreco(novo)
                }
              }}
            />
          </div>
          <div>
            <Label htmlFor={`qest-${produto.id}`} className="text-[10px] text-muted-foreground">
              Estoque
            </Label>
            <Input
              id={`qest-${produto.id}`}
              type="number"
              min="0"
              defaultValue={produto.estoque}
              className="h-8 text-xs"
              onBlur={(e) => {
                const novo = Math.max(0, Number(e.target.value) || 0)
                if (novo !== produto.estoque) {
                  onQuickEditEstoque(novo)
                }
              }}
            />
          </div>

          </div>
        )}

        {/* Ações */}
        <div className="flex items-center justify-end gap-1 pt-1 border-t border-border">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={onEditar}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 text-destructive"
            onClick={onExcluir}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* --------------------------------------------------------------------- */
/* VendaCard                                                             */
/* --------------------------------------------------------------------- */

interface VendaCardProps {
  venda: Venda
  onExcluir: () => void
  onMudarStatus: (status: StatusVenda) => void
}

function VendaCard({ venda, onExcluir, onMudarStatus }: VendaCardProps) {
  const [expandido, setExpandido] = useState(false)
  const canalMeta = CANAL_META[venda.canal] || CANAL_META.loja
  const statusMeta = STATUS_VENDA_META[venda.status] || STATUS_VENDA_META.pendente
  const idCurto = `#${venda.id.slice(-6).toUpperCase()}`
  const dataRelativa = formatDistanceToNow(parseISO(venda.createdAt), {
    addSuffix: true,
    locale: ptBR,
  })

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold">{idCurto}</span>
              <Badge className={cn('text-[10px] border', canalMeta.badge)}>
                {canalMeta.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dataRelativa} ·{' '}
              {format(parseISO(venda.createdAt), 'dd/MM/yyyy HH:mm')}
            </p>
            <p className="text-sm truncate mt-1">
              {venda.cliente?.nome || 'Venda sem cliente'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-primary">
              {fmtMoeda(venda.total)}
            </p>
            <Badge className={cn('text-[10px] border', statusMeta.badge)}>
              {statusMeta.label}
            </Badge>
          </div>
        </div>

        {/* Itens resumido */}
        <div className="flex items-center gap-1 flex-wrap text-xs">
          {venda.itens?.slice(0, 3).map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[11px]"
            >
              <span aria-hidden>{emojiCategoria(item.produto?.categoria || '')}</span>
              <span className="truncate max-w-[140px]">
                {item.produto?.nome || 'Produto removido'}
              </span>
              <span className="text-muted-foreground">×{item.quantidade}</span>
            </span>
          ))}
          {venda.itens && venda.itens.length > 3 && (
            <span className="text-[11px] text-muted-foreground">
              +{venda.itens.length - 3} itens
            </span>
          )}
        </div>

        {/* Observação */}
        {venda.observacoes && !expandido && (
          <p className="text-xs text-muted-foreground italic line-clamp-1">
            “{venda.observacoes}”
          </p>
        )}

        {/* Expandir para ver itens */}
        {venda.itens && venda.itens.length > 0 && (
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            {expandido ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            {expandido ? 'Recolher itens' : `Ver ${venda.itens.length} item(ns)`}
          </button>
        )}

        {expandido && (
          <div className="space-y-1 border-l-2 border-border pl-3">
            {venda.itens?.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-1 truncate">
                  <span aria-hidden>{emojiCategoria(item.produto?.categoria || '')}</span>
                  <span className="truncate">{item.produto?.nome || 'Produto removido'}</span>
                  <span className="text-muted-foreground">×{item.quantidade}</span>
                </span>
                <span className="font-medium tabular-nums shrink-0">
                  {fmtMoeda(item.precoUnit * item.quantidade)}
                </span>
              </div>
            ))}
            {venda.observacoes && (
              <p className="text-xs text-muted-foreground italic pt-1">
                “{venda.observacoes}”
              </p>
            )}
          </div>
        )}

        {/* Ações: mudar status inline */}
        <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-border">
          <Select
            value={venda.status}
            onValueChange={(v) => onMudarStatus(v as StatusVenda)}
          >
            <SelectTrigger className="h-7 w-auto text-[11px] flex-1 min-w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-destructive"
            onClick={onExcluir}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* --------------------------------------------------------------------- */
/* Componente principal                                                   */
/* --------------------------------------------------------------------- */

const ORDENACAO_OPCOES = [
  { value: 'recente', label: 'Mais recente' },
  { value: 'nome', label: 'Nome (A-Z)' },
  { value: 'preco_asc', label: 'Preço (menor)' },
  { value: 'preco_desc', label: 'Preço (maior)' },
  { value: 'estoque_asc', label: 'Estoque (menor)' },
  { value: 'estoque_desc', label: 'Estoque (maior)' },
] as const

const PERIODO_VENDAS = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7dias', label: 'Últimos 7 dias' },
  { value: '30dias', label: 'Últimos 30 dias' },
  { value: 'mes', label: 'Este mês' },
  { value: 'todas', label: 'Todas' },
] as const

type Ordenacao = (typeof ORDENACAO_OPCOES)[number]['value']
type PeriodoVenda = (typeof PERIODO_VENDAS)[number]['value']

export function EcommerceView({ refreshSignal }: { refreshSignal?: number }) {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [vendas, setVendas] = useState<Venda[]>([])
  const [loadingProdutos, setLoadingProdutos] = useState(true)
  const [loadingVendas, setLoadingVendas] = useState(true)
  const [syncingZetta, setSyncingZetta] = useState(false)

  // Tab controlada — permite trocar para "vendas" automaticamente ao receber
  // uma nova venda via WebSocket ou via quick action do dashboard.
  const [tabValue, setTabValue] = useState<'produtos' | 'vendas'>('produtos')
  const [showNovaVendaBadge, setShowNovaVendaBadge] = useState(false)
  const vendasSectionRef = useRef<HTMLDivElement>(null)
  const badgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // dialog produto
  const [dialogProduto, setDialogProduto] = useState(false)
  const [editProduto, setEditProduto] = useState<Produto | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [dialogVenda, setDialogVenda] = useState(false)
  const [formVenda, setFormVenda] = useState<{
    itens: Array<{ produtoId: string; quantidade: number }>
    observacoes: string
  }>({ itens: [], observacoes: '' })

  const [confirmExcluir, setConfirmExcluir] = useState<
    | { tipo: 'produto'; id: string; nome: string }
    | { tipo: 'venda'; id: string }
    | null
  >(null)

  // filtros produtos
  const [buscaProduto, setBuscaProduto] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')
  const [estoqueBaixo, setEstoqueBaixo] = useState(false)
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('recente')
  const [faixaPreco, setFaixaPreco] = useState<[number, number]>([0, 1000])

  // filtros vendas
  const [buscaVenda, setBuscaVenda] = useState('')
  const [filtroStatusVenda, setFiltroStatusVenda] = useState<string>('todos')
  const [filtroCanalVenda, setFiltroCanalVenda] = useState<string>('todos')
  const [periodoVenda, setPeriodoVenda] = useState<PeriodoVenda>('7dias')

  const carregar = useCallback(async () => {
    setLoadingProdutos(true)
    setLoadingVendas(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/produtos', { credentials: 'same-origin' }),
        fetch('/api/vendas', { credentials: 'same-origin' }),
      ])
      if (r1.ok) {
        const ps: Produto[] = await r1.json()
        setProdutos(ps)
        const max = Math.max(100, ...ps.map((p) => Math.ceil(p.preco)))
        setFaixaPreco([0, max])
      }
      if (r2.ok) setVendas(await r2.json())
    } catch (e) {
      console.error('ecommerce erro:', e)
    } finally {
      setLoadingProdutos(false)
      setLoadingVendas(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /* ---------------------- realtime: nova venda ---------------------- */

  const handleNovaVenda = useCallback(
    (_data?: unknown) => {
      // Recarrega vendas (e produtos para atualizar estoque)
      carregar()
      // Mostra badge pulsante "Nova venda!" por 5 segundos
      setShowNovaVendaBadge(true)
      if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current)
      badgeTimerRef.current = setTimeout(() => {
        setShowNovaVendaBadge(false)
      }, 5000)
      // Troca para a aba de vendas e faz scroll suave até a seção
      setTabValue('vendas')
      setTimeout(() => {
        vendasSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 80)
    },
    [carregar]
  )

  // Escuta evento WebSocket venda:nova
  useRealtime([
    { event: 'venda:nova', handler: (d) => handleNovaVenda(d) },
  ])

  // Refresca quando o AdminPanel sinaliza (caso o usuário esteja em outra tab
  // e o evento WebSocket não tenha chegado aqui, ou para forçar refresh visual).
  const lastSignalRef = useRef(refreshSignal)
  useEffect(() => {
    if (refreshSignal === undefined) return
    if (refreshSignal !== lastSignalRef.current) {
      lastSignalRef.current = refreshSignal
      handleNovaVenda()
    }
  }, [refreshSignal, handleNovaVenda])

  /* ---------------------- quick actions via window event ---------------------- */

  // Quick action "Novo Produto" vinda do DashboardView
  useEffect(() => {
    const handler = () => {
      setTabValue('produtos')
      abrirNovoProduto()
    }
    window.addEventListener('ecommerce:novo-produto', handler)
    return () => window.removeEventListener('ecommerce:novo-produto', handler)
  }, [])

  // Quick action "Registrar Venda" vinda do DashboardView
  useEffect(() => {
    const handler = () => {
      setTabValue('vendas')
      abrirNovaVenda()
    }
    window.addEventListener('ecommerce:nova-venda', handler)
    return () => window.removeEventListener('ecommerce:nova-venda', handler)
  }, [])

  // Cleanup do timer do badge ao desmontar
  useEffect(() => {
    return () => {
      if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current)
    }
  }, [])

  /* ---------------------- produtos: filtros + ordenação ---------------------- */

  const categorias = useMemo(() => {
    const set = new Set<string>()
    produtos.forEach((p) => {
      if (p.categoria) set.add(p.categoria)
    })
    return Array.from(set).sort()
  }, [produtos])

  const produtosFiltrados = useMemo(() => {
    const termo = buscaProduto.trim().toLowerCase()
    const filtrados = produtos.filter((p) => {
      if (termo) {
        const nome = (p.nome || '').toLowerCase()
        const descricao = (p.descricao || '').toLowerCase()
        const sku = (p.sku || '').toLowerCase()
        if (
          !nome.includes(termo) &&
          !descricao.includes(termo) &&
          !sku.includes(termo)
        ) {
          return false
        }
      }
      if (filtroCategoria !== 'todas') {
        if (p.categoria !== filtroCategoria) return false
      }
      if (estoqueBaixo) {
        if (p.estoque >= 5) return false
      }
      const preco = p.precoPromo ?? p.preco
      if (preco < faixaPreco[0] || preco > faixaPreco[1]) return false
      return true
    })

    const ordenados = [...filtrados]
    switch (ordenacao) {
      case 'nome':
        ordenados.sort((a, b) => a.nome.localeCompare(b.nome))
        break
      case 'preco_asc':
        ordenados.sort((a, b) => (a.precoPromo ?? a.preco) - (b.precoPromo ?? b.preco))
        break
      case 'preco_desc':
        ordenados.sort((a, b) => (b.precoPromo ?? b.preco) - (a.precoPromo ?? a.preco))
        break
      case 'estoque_asc':
        ordenados.sort((a, b) => a.estoque - b.estoque)
        break
      case 'estoque_desc':
        ordenados.sort((a, b) => b.estoque - a.estoque)
        break
      case 'recente':
      default:
        ordenados.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        break
    }
    return ordenados
  }, [produtos, buscaProduto, filtroCategoria, estoqueBaixo, ordenacao, faixaPreco])

  /* ---------------------- vendas: filtros + período ---------------------- */

  const intervaloVendas = useMemo(() => {
    const hoje = startOfDay(new Date())
    if (periodoVenda === 'hoje') {
      return { start: hoje, end: new Date() }
    }
    if (periodoVenda === '7dias') {
      return { start: subDays(hoje, 7), end: new Date() }
    }
    if (periodoVenda === '30dias') {
      return { start: subDays(hoje, 30), end: new Date() }
    }
    if (periodoVenda === 'mes') {
      return { start: startOfMonth(hoje), end: new Date() }
    }
    return null
  }, [periodoVenda])

  const vendasFiltradas = useMemo(() => {
    const termo = buscaVenda.trim().toLowerCase()
    return vendas.filter((v) => {
      if (termo) {
        const cliente = (v.cliente?.nome || '').toLowerCase()
        const canal = (v.canal || '').toLowerCase()
        const idCurto = v.id.slice(-6).toLowerCase()
        if (
          !cliente.includes(termo) &&
          !canal.includes(termo) &&
          !idCurto.includes(termo)
        ) {
          return false
        }
      }
      if (filtroStatusVenda !== 'todos') {
        if (v.status !== filtroStatusVenda) return false
      }
      if (filtroCanalVenda !== 'todos') {
        if (v.canal !== filtroCanalVenda) return false
      }
      if (intervaloVendas) {
        const d = parseISO(v.createdAt)
        try {
          if (!isWithinInterval(d, intervaloVendas)) return false
        } catch {
          return false
        }
      }
      return true
    })
  }, [vendas, buscaVenda, filtroStatusVenda, filtroCanalVenda, intervaloVendas])

  /* ---------------------- stats vendas ---------------------- */

  const statsVendas = useMemo(() => {
    const hoje = new Date()
    const hojeVendas = vendas.filter(
      (v) => v.status === 'concluida' && isSameDay(parseISO(v.createdAt), hoje)
    )
    const vendasHoje = hojeVendas.length
    const faturamentoHoje = hojeVendas.reduce((s, v) => s + v.total, 0)
    const todasConcluidas = vendas.filter((v) => v.status === 'concluida')
    const totalConcluidas = todasConcluidas.length
    const ticketMedio = totalConcluidas
      ? todasConcluidas.reduce((s, v) => s + v.total, 0) / totalConcluidas
      : 0
    const totalVendas = vendas.length
    const conversao = totalVendas
      ? Math.round((totalConcluidas / totalVendas) * 100)
      : 0
    return { vendasHoje, faturamentoHoje, ticketMedio, conversao }
  }, [vendas])

  /* ---------------------- tem filtros ativos ---------------------- */

  const temFiltrosProduto =
    buscaProduto.trim() !== '' ||
    filtroCategoria !== 'todas' ||
    estoqueBaixo ||
    faixaPreco[0] > 0 ||
    faixaPreco[1] < 10000
  const temFiltrosVenda =
    buscaVenda.trim() !== '' ||
    filtroStatusVenda !== 'todos' ||
    filtroCanalVenda !== 'todos' ||
    periodoVenda !== 'todas'

  const limparFiltrosProduto = () => {
    setBuscaProduto('')
    setFiltroCategoria('todas')
    setEstoqueBaixo(false)
    const max = Math.max(100, ...produtos.map((p) => Math.ceil(p.preco)))
    setFaixaPreco([0, max])
    setOrdenacao('recente')
  }

  const limparFiltrosVenda = () => {
    setBuscaVenda('')
    setFiltroStatusVenda('todos')
    setFiltroCanalVenda('todos')
    setPeriodoVenda('todas')
  }

  /* ---------------------- ações produtos ---------------------- */

  const sincronizarProdutosZetta = async () => {
    setSyncingZetta(true)
    try {
      const res = await fetch('/api/admin/zetta/produtos/sincronizar', {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Não foi possível sincronizar o catálogo do ERP.')
      }
      toast.success(`${data.sincronizados} produto(s) sincronizado(s) com o Zetta.`)
      await carregar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao sincronizar produtos.')
    } finally {
      setSyncingZetta(false)
    }
  }

  const abrirNovoProduto = () => {
    setEditProduto(null)
    setForm({
      nome: '',
      descricao: '',
      categoria: 'Pet Shop',
      preco: 0,
      precoPromo: '',
      estoque: 0,
      sku: '',
      imageUrl: '',
      ativo: true,
    })
    setDialogProduto(true)
  }

  const abrirEdicaoProduto = (p: Produto) => {
    setEditProduto(p)
    setForm({
      nome: p.nome,
      descricao: p.descricao || '',
      categoria: p.categoria,
      preco: p.preco,
      precoPromo: p.precoPromo ?? '',
      estoque: p.estoque,
      sku: p.sku || '',
      imageUrl: p.imageUrl || '',
      ativo: p.ativo,
    })
    setDialogProduto(true)
  }

  const salvarProduto = async () => {
    if (!form.nome || form.preco == null) {
      toast.error('Preencha nome e preço')
      return
    }
    try {
      const body = {
        nome: form.nome,
        descricao: (form.descricao as string) || null,
        categoria: (form.categoria as string) || 'Pet Shop',
        preco: Number(form.preco) || 0,
        precoPromo: form.precoPromo ? Number(form.precoPromo) : null,
        estoque: Number(form.estoque) || 0,
        sku: (form.sku as string) || null,
        imageUrl: (form.imageUrl as string) || null,
        ativo: form.ativo ?? true,
      }
      const url = editProduto
        ? `/api/produtos/${editProduto.id}`
        : '/api/produtos'
      const method = editProduto ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success(editProduto ? 'Produto atualizado' : 'Produto criado')
      setDialogProduto(false)
      carregar()
    } catch {
      toast.error('Erro ao salvar produto')
    }
  }

  const excluirProduto = async (id: string) => {
    try {
      const res = await fetch(`/api/produtos/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error()
      toast.success('Produto excluído')
      carregar()
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  const toggleProdutoAtivo = async (p: Produto) => {
    try {
      const res = await fetch(`/api/produtos/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ativo: !p.ativo }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Produto ${!p.ativo ? 'ativado' : 'desativado'}`)
      setProdutos((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, ativo: !p.ativo } : x))
      )
    } catch {
      toast.error('Erro ao atualizar produto')
    }
  }

  const quickEditProduto = async (
    p: Produto,
    dados: Partial<Pick<Produto, 'preco' | 'precoPromo' | 'estoque'>>
  ) => {
    try {
      const res = await fetch(`/api/produtos/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(dados),
      })
      if (!res.ok) throw new Error()
      toast.success('Produto atualizado')
      setProdutos((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, ...dados } : x))
      )
    } catch {
      toast.error('Erro ao atualizar produto')
    }
  }

  /* ---------------------- ações vendas ---------------------- */

  const abrirNovaVenda = () => {
    setFormVenda({ itens: [], observacoes: '' })
    setDialogVenda(true)
  }

  const addItem = () => {
    setFormVenda((prev) => ({
      ...prev,
      itens: [...prev.itens, { produtoId: '', quantidade: 1 }],
    }))
  }

  const salvarVenda = async () => {
    const validos = formVenda.itens.filter((i) => i.produtoId && i.quantidade > 0)
    if (validos.length === 0) {
      toast.error('Adicione pelo menos um item')
      return
    }
    try {
      const res = await fetch('/api/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          itens: validos,
          observacoes: formVenda.observacoes || null,
          canal: 'loja',
          status: 'concluida',
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Erro ao criar venda')
      }
      toast.success('Venda registrada')
      setDialogVenda(false)
      carregar()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar venda'
      toast.error(msg)
    }
  }

  const excluirVenda = async (id: string) => {
    try {
      const res = await fetch(`/api/vendas/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error()
      toast.success('Venda excluída')
      carregar()
    } catch {
      toast.error('Erro ao excluir venda')
    }
  }

  const mudarStatusVenda = async (id: string, status: StatusVenda) => {
    try {
      const res = await fetch(`/api/vendas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success('Status da venda atualizado')
      setVendas((prev) =>
        prev.map((v) => (v.id === id ? { ...v, status } : v))
      )
    } catch {
      toast.error('Erro ao atualizar venda')
    }
  }

  const maxPrecoSlider = Math.max(100, ...produtos.map((p) => Math.ceil(p.preco)))

  /* ---------------------- render ---------------------- */

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Estoque</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Gerencie produtos, preços e quantidades em estoque
        </p>
      </div>

      {/* Apenas estoque - vendas são gerenciadas pelo cliente no portal */}
      {/* ================= PRODUTOS / ESTOQUE ================= */}
      <div className="space-y-4">
          {/* Filtros */}
          <div className="bg-card/50 border border-border rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Buscar por nome, descrição ou SKU..."
                  value={buscaProduto}
                  onChange={(e) => setBuscaProduto(e.target.value)}
                  className="pl-9 h-9"
                />
                {buscaProduto && (
                  <button
                    type="button"
                    onClick={() => setBuscaProduto('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="w-full sm:w-[180px] h-9">
                  <Filter className="size-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  {categorias.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as Ordenacao)}>
                <SelectTrigger className="w-full sm:w-[180px] h-9">
                  <ArrowDownUp className="size-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  {ORDENACAO_OPCOES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 px-3 border border-border rounded-md h-9 bg-background">
                <Switch
                  id="estoque-baixo"
                  checked={estoqueBaixo}
                  onCheckedChange={setEstoqueBaixo}
                />
                <Label
                  htmlFor="estoque-baixo"
                  className="text-xs whitespace-nowrap cursor-pointer"
                >
                  Estoque baixo
                </Label>
              </div>
              <div className="flex-1 flex items-center gap-3 px-3 border border-border rounded-md h-9 bg-background">
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  Faixa de preço:
                </span>
                <Slider
                  value={faixaPreco}
                  onValueChange={(v) => setFaixaPreco([v[0], v[1]] as [number, number])}
                  min={0}
                  max={maxPrecoSlider}
                  step={1}
                  className="flex-1"
                />
                <span className="text-[11px] tabular-nums whitespace-nowrap">
                  {fmtMoeda(faixaPreco[0])} – {fmtMoeda(faixaPreco[1])}
                </span>
              </div>
            </div>
            {temFiltrosProduto && (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  Mostrando {produtosFiltrados.length} de {produtos.length} produto(s)
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={limparFiltrosProduto}
                  className="h-7 text-xs"
                >
                  <X className="size-3" /> Limpar filtros
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void sincronizarProdutosZetta()}
              disabled={syncingZetta}
              className="h-9 sm:h-10"
            >
              <RefreshCw className={`size-4 ${syncingZetta ? 'animate-spin' : ''}`} />
              <span className="ml-1 hidden sm:inline">
                {syncingZetta ? 'Sincronizando...' : 'Sincronizar Zetta'}
              </span>
            </Button>
            <ExportButton
              type="produtos"
              label="Exportar Produtos"
              variant="outline"
            />
            <Button onClick={abrirNovoProduto} className="h-9 sm:h-10">
              <Plus className="size-4" /> <span className="ml-1">Novo produto</span>
            </Button>
          </div>

          {loadingProdutos && <SkeletonLoader type="cards" count={8} />}

          {!loadingProdutos && (
            <>
              {produtos.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground gap-2 border border-dashed border-border rounded-xl">
                  <Package className="size-10 opacity-40" />
                  <p className="text-sm">Nenhum produto cadastrado.</p>
                  <Button variant="outline" size="sm" onClick={abrirNovoProduto} className="h-8 mt-1">
                    <Plus className="size-3.5" /> Cadastrar produto
                  </Button>
                </div>
              )}
              {produtos.length > 0 && produtosFiltrados.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground gap-2 border border-dashed border-border rounded-xl">
                  <Search className="size-10 opacity-40" />
                  <p className="text-sm">Nenhum produto encontrado.</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {produtosFiltrados.map((p) => (
                  <ProdutoCard
                    key={p.id}
                    produto={p}
                    onEditar={() => abrirEdicaoProduto(p)}
                    onExcluir={() =>
                      setConfirmExcluir({
                        tipo: 'produto',
                        id: p.id,
                        nome: p.nome,
                      })
                    }
                    onToggleAtivo={() => toggleProdutoAtivo(p)}
                    onQuickEditPreco={(novo) =>
                      quickEditProduto(p, { preco: novo })
                    }
                    onQuickEditEstoque={(novo) =>
                      quickEditProduto(p, { estoque: novo })
                    }
                  />
                ))}
              </div>
            </>
          )}
      </div>

      {/* Dialog produto */}
      <Dialog open={dialogProduto} onOpenChange={setDialogProduto}>
        <DialogContent className="sm:max-w-2xl max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {editProduto ? 'Editar produto' : 'Novo produto'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {editProduto?.zettaProCod
                ? 'Produto vinculado ao ERP: nome, SKU, preço e estoque são controlados pelo Zetta.'
                : 'Dados do produto da loja'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={(form.nome as string) || ''}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                              disabled={Boolean(editProduto?.zettaProCod)}
/>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="desc">Descrição</Label>
              <Textarea
                id="desc"
                rows={2}
                value={(form.descricao as string) || ''}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cat">Categoria</Label>
              <Input
                id="cat"
                value={(form.categoria as string) || ''}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={(form.sku as string) || ''}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                              disabled={Boolean(editProduto?.zettaProCod)}
/>
            </div>
            <div>
              <Label htmlFor="preco">Preço (R$)</Label>
              <Input
                id="preco"
                type="number"
                step="0.01"
                value={(form.preco as number | string) ?? 0}
                onChange={(e) => setForm({ ...form, preco: e.target.value })}
                              disabled={Boolean(editProduto?.zettaProCod)}
/>
            </div>
            <div>
              <Label htmlFor="precoPromo">Preço promocional (R$)</Label>
              <Input
                id="precoPromo"
                type="number"
                step="0.01"
                value={(form.precoPromo as number | string) ?? ''}
                onChange={(e) => setForm({ ...form, precoPromo: e.target.value })}
                              disabled={Boolean(editProduto?.zettaProCod)}
/>
            </div>
            <div>
              <Label htmlFor="estoque">Estoque</Label>
              <Input
                id="estoque"
                type="number"
                value={(form.estoque as number | string) ?? 0}
                onChange={(e) => setForm({ ...form, estoque: e.target.value })}
                              disabled={Boolean(editProduto?.zettaProCod)}
/>
            </div>
            <div>
              <Label htmlFor="imageUrl">URL da imagem</Label>
              <Input
                id="imageUrl"
                value={(form.imageUrl as string) || ''}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ativo">Ativo</Label>
              <Select
                value={form.ativo ? 'true' : 'false'}
                onValueChange={(v) => setForm({ ...form, ativo: v === 'true' })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativo</SelectItem>
                  <SelectItem value="false">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={salvarProduto} className="h-10">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog venda */}
      <Dialog open={dialogVenda} onOpenChange={setDialogVenda}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <DollarSign className="size-4" /> Nova venda (loja física)
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Produtos do ERP Zetta devem ser vendidos no Siggma até a API oficial de pedidos ser integrada. Aqui aparecem apenas produtos locais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {formVenda.itens.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <Select
                  value={item.produtoId}
                  onValueChange={(v) => {
                    const itens = [...formVenda.itens]
                    itens[idx].produtoId = v
                    setFormVenda({ ...formVenda, itens })
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.filter((p) => !p.zettaProCod).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} — {fmtMoeda(p.precoPromo ?? p.preco)} (est: {p.estoque})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={item.quantidade}
                    className="w-20"
                    onChange={(e) => {
                      const itens = [...formVenda.itens]
                      itens[idx].quantidade = Number(e.target.value) || 1
                      setFormVenda({ ...formVenda, itens })
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive size-9"
                    onClick={() => {
                      const itens = formVenda.itens.filter((_, i) => i !== idx)
                      setFormVenda({ ...formVenda, itens })
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addItem} className="h-9">
              <Plus className="size-4" /> Adicionar item
            </Button>
            <div>
              <Label htmlFor="obs-venda">Observações</Label>
              <Textarea
                id="obs-venda"
                rows={2}
                value={formVenda.observacoes}
                onChange={(e) =>
                  setFormVenda({ ...formVenda, observacoes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={salvarVenda} className="h-10 w-full sm:w-auto">
              Registrar venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <ConfirmDialog
        open={!!confirmExcluir}
        onOpenChange={(o) => !o && setConfirmExcluir(null)}
        title={confirmExcluir?.tipo === 'produto' ? 'Excluir produto?' : 'Excluir venda?'}
        description={
          confirmExcluir?.tipo === 'produto'
            ? `Excluir "${confirmExcluir.nome}"? Itens de vendas já registradas não serão afetados. Esta ação não pode ser desfeita.`
            : 'Excluir esta venda? O estoque dos produtos será restaurado. Esta ação não pode ser desfeita.'
        }
        confirmText="Excluir"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmExcluir) return
          if (confirmExcluir.tipo === 'produto') await excluirProduto(confirmExcluir.id)
          else await excluirVenda(confirmExcluir.id)
        }}
      />
    </div>
  )
}
