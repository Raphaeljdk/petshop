'use client'

import { useEffect, useState } from 'react'
import {
  CalendarClock,
  ShoppingBag,
  Dog,
  Clock,
  Package,
  TrendingUp,
  ChevronRight,
  Sparkles,
  Heart,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { format, parseISO, isToday, isTomorrow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface PetInfo {
  id: string
  nome: string
  especie: string
  raca?: string | null
  fotoUrl?: string | null
  ultimoProcesso?: {
    status: string
    servico: string
    createdAt: string
  } | null
}

interface AgendamentoInfo {
  id: string
  servico: string
  dataHora: string
  status: string
  pet: { nome: string; especie: string; fotoUrl?: string | null }
}

interface CompraInfo {
  id: string
  total: number
  status: string
  createdAt: string
  itens: Array<{ quantidade: number; nome: string; imageUrl?: string | null }>
}

interface ProdutoDestaque {
  id: string
  nome: string
  preco: number
  precoPromo?: number | null
  imageUrl?: string | null
  categoria: string
}

interface DashboardData {
  cliente: { nome: string; telefone: string; email: string | null; cep?: string | null }
  stats: {
    totalPets: number
    totalAgendamentos: number
    totalCompras: number
    totalGasto: number
    processosAtivos: number
  }
  pets: PetInfo[]
  proximosAgendamentos: AgendamentoInfo[]
  ultimasCompras: CompraInfo[]
  produtosDestaque: ProdutoDestaque[]
}

const ESPECIE_ICONE: Record<string, string> = {
  cachorro: '🐕',
  gato: '🐱',
  coelho: '🐰',
  ave: '🦜',
  calopsita: '🦜',
  roedor: '🐹',
}

const STATUS_PROCESSO: Record<string, { label: string; cor: string }> = {
  novo: { label: 'Na fila', cor: 'bg-amber-100 text-amber-700' },
  em_andamento: { label: 'Em atendimento', cor: 'bg-cyan-100 text-cyan-700' },
  finalizado: { label: 'Pronto!', cor: 'bg-green-100 text-green-700' },
}

interface ClientHomeProps {
  onIrParaLoja: () => void
  onIrParaAgendamentos: () => void
  onIrParaPets: () => void
  onIrParaCompras: () => void
}

export function ClientHome({
  onIrParaLoja,
  onIrParaAgendamentos,
  onIrParaPets,
  onIrParaCompras,
}: ClientHomeProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelado = false
    async function carregar() {
      try {
        const res = await fetch('/api/cliente/dashboard', { credentials: 'same-origin' })
        if (res.ok && !cancelado) {
          setData(await res.json())
        }
      } catch (e) {
        console.error('ClientHome erro:', e)
      } finally {
        if (!cancelado) setLoading(false)
      }
    }
    carregar()
    return () => {
      cancelado = true
    }
  }, [retry])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 rounded-2xl bg-muted animate-pulse" />
        <SkeletonLoader type="cards" count={4} />
        <SkeletonLoader type="list" count={3} />
      </div>
    )
  }

  if (!data) {
    return <Card><CardContent className="py-8 text-center space-y-4">
      <Heart className="size-8 text-primary mx-auto" />
      <h1 className="text-xl font-semibold">Não conseguimos carregar sua página</h1>
      <p className="text-sm text-muted-foreground">Tente novamente para ver seus pets e agendamentos.</p>
      <Button onClick={() => { setLoading(true); setRetry(value => value + 1) }}>Tentar novamente</Button>
    </CardContent></Card>
  }

  const nome = data.cliente.nome?.split(' ')[0] || 'Cliente'

  function formatarDataHora(dataStr: string) {
    const d = parseISO(dataStr)
    if (isToday(d)) return `Hoje às ${format(d, 'HH:mm', { locale: ptBR })}`
    if (isTomorrow(d)) return `Amanhã às ${format(d, 'HH:mm', { locale: ptBR })}`
    return format(d, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })
  }

  return (
    <div className="space-y-6">
      {/* ===== BANNER DE BOAS-VINDAS ===== */}
      <div className="client-welcome relative overflow-hidden rounded-2xl text-white p-6 sm:p-9">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 size-48 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 size-40 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-5 text-orange-300" />
            <span className="text-sm text-white/80">Bem-vindo de volta,</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{nome}!</h1>
          <p className="text-white/80 text-sm sm:text-base max-w-lg">
            Gerencie seus pets, agende serviços e compre produtos premium para seu melhor amigo.
          </p>

          {/* Stats inline */}
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="flex items-center gap-2">
              <Dog className="size-5 text-orange-300" />
              <span className="text-2xl font-bold">{data.stats.totalPets}</span>
              <span className="text-xs text-white/70">pets</span>
            </div>
            <div className="w-px bg-white/20" />
            <div className="flex items-center gap-2">
              <CalendarClock className="size-5 text-cyan-300" />
              <span className="text-2xl font-bold">{data.stats.totalAgendamentos}</span>
              <span className="text-xs text-white/70">agendamentos</span>
            </div>
            <div className="w-px bg-white/20" />
            <div className="flex items-center gap-2">
              <ShoppingBag className="size-5 text-green-300" />
              <span className="text-2xl font-bold">{data.stats.totalCompras}</span>
              <span className="text-xs text-white/70">compras</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== ATALHOS RÁPIDOS ===== */}
      <div className="stagger-grid grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Button
          variant="outline"
          className="h-auto min-h-24 flex-col sm:flex-row gap-3 p-5 card-hover bg-card"
          onClick={onIrParaAgendamentos}
        >
          <CalendarClock className="size-6 text-primary" />
          <span className="text-sm font-medium">Agendar</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto min-h-24 flex-col sm:flex-row gap-3 p-5 card-hover bg-card"
          onClick={onIrParaLoja}
        >
          <ShoppingBag className="size-6 text-primary" />
          <span className="text-sm font-medium">Comprar</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto min-h-24 flex-col sm:flex-row gap-3 p-5 card-hover bg-card"
          onClick={onIrParaPets}
        >
          <Dog className="size-6 text-primary" />
          <span className="text-sm font-medium">Meus Pets</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto min-h-24 flex-col sm:flex-row gap-3 p-5 card-hover bg-card"
          onClick={onIrParaCompras}
        >
          <Package className="size-6 text-primary" />
          <span className="text-sm font-medium">Minhas Compras</span>
        </Button>
      </div>

      {/* ===== GRID 2 COLUNAS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ===== PRÓXIMOS AGENDAMENTOS ===== */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" />
              Próximos Agendamentos
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onIrParaAgendamentos} className="h-7 text-xs">
              Ver todos <ChevronRight className="size-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.proximosAgendamentos.length === 0 ? (
              <div className="text-center py-8">
                <CalendarClock className="size-10 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Nenhum agendamento próximo</p>
                <Button size="sm" className="mt-3 btn-brand" onClick={onIrParaAgendamentos}>
                  Agendar agora
                </Button>
              </div>
            ) : (
              data.proximosAgendamentos.map((ag) => (
                <div
                  key={ag.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-primary/30 transition-colors"
                >
                  <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-xl shrink-0">
                    {ESPECIE_ICONE[ag.pet.especie] || '🐾'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{ag.pet.nome}</p>
                    <p className="text-xs text-muted-foreground capitalize">{ag.servico.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-primary mt-0.5">{formatarDataHora(ag.dataHora)}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      ag.status === 'confirmado'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }
                  >
                    {ag.status === 'confirmado' ? 'Confirmado' : 'Agendado'}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ===== STATUS DOS PETS ===== */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Dog className="size-4 text-primary" />
              Status dos Meus Pets
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onIrParaPets} className="h-7 text-xs">
              Ver todos <ChevronRight className="size-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.pets.length === 0 ? (
              <div className="text-center py-8">
                <Dog className="size-10 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Nenhum pet cadastrado</p>
                <Button size="sm" className="mt-3 btn-brand" onClick={onIrParaPets}>
                  Cadastrar pet
                </Button>
              </div>
            ) : (
              data.pets.map((pet) => {
                const proc = pet.ultimoProcesso
                const statusInfo = proc ? STATUS_PROCESSO[proc.status] : null
                return (
                  <div
                    key={pet.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-primary/30 transition-colors"
                  >
                    <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-xl shrink-0">
                      {ESPECIE_ICONE[pet.especie] || '🐾'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{pet.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {pet.raca || pet.especie}
                      </p>
                      {proc && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {proc.servico.replace(/_/g, ' ')} •{' '}
                          {format(parseISO(proc.createdAt), "dd/MM", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                    {statusInfo ? (
                      <Badge className={statusInfo.cor}>{statusInfo.label}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Sem atendimentos
                      </Badge>
                    )}
                  </div>
                )
              })
            )}
            {data.stats.processosAtivos > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <Clock className="size-3.5" />
                {data.stats.processosAtivos} pet(s) em atendimento agora!
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== ÚLTIMAS COMPRAS + PRODUTOS EM DESTAQUE ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimas compras */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="size-4 text-primary" />
              Últimas Compras
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onIrParaCompras} className="h-7 text-xs">
              Ver todas <ChevronRight className="size-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.ultimasCompras.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingBag className="size-10 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Nenhuma compra ainda</p>
                <Button size="sm" className="mt-3 btn-brand" onClick={onIrParaLoja}>
                  Ir às compras
                </Button>
              </div>
            ) : (
              data.ultimasCompras.map((compra) => (
                <div key={compra.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-lg">
                    {compra.itens[0]?.imageUrl || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      R$ {compra.total.toFixed(2).replace('.', ',')}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {compra.itens.length > 1
                        ? `${compra.itens[0].nome} +${compra.itens.length - 1} item(s)`
                        : compra.itens[0]?.nome || 'Compra'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(compra.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      compra.status === 'concluida'
                        ? 'bg-green-100 text-green-700'
                        : compra.status === 'enviada'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }
                  >
                    {compra.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Produtos em destaque */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Produtos em Destaque
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onIrParaLoja} className="h-7 text-xs">
              Ver loja <ChevronRight className="size-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {data.produtosDestaque.map((p) => (
                <button
                  key={p.id}
                  onClick={onIrParaLoja}
                  className="flex flex-col gap-1 p-2 rounded-lg border text-left hover:border-primary/40 hover:shadow-md transition-all"
                >
                  <div className="aspect-square bg-muted rounded-md flex items-center justify-center text-3xl">
                    {p.imageUrl || '📦'}
                  </div>
                  <p className="text-xs font-medium line-clamp-1">{p.nome}</p>
                  <div className="flex items-baseline gap-1">
                    {p.precoPromo ? (
                      <>
                        <span className="text-sm font-bold text-green-700">
                          R$ {p.precoPromo.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="text-[10px] text-muted-foreground line-through">
                          R$ {p.preco.toFixed(2).replace('.', ',')}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-bold">
                        R$ {p.preco.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== FOOTER INFO ===== */}
      <Card className="bg-gradient-to-br from-orange-50 to-pink-50 border-orange-200">
        <CardContent className="p-4 flex items-center gap-3">
          <Heart className="size-6 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Matilha Prado</span> — Uma família
            cuidando da sua família. 🐾
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
