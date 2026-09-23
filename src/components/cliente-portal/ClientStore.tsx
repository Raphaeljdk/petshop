'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Package,
  ArrowLeft,
  PartyPopper,
  Sparkles,
  TicketPercent,
  Loader2,
  X,
  MessageCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { FreteCalculator } from '@/components/cliente-portal/FreteCalculator'
import { PagamentoCheckout } from '@/components/cliente-portal/PagamentoCheckout'
import { toast } from 'sonner'
import type { Produto, TipoEntrega, Venda } from '@/lib/types'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'

interface ClientStoreProps {
  onCompraFinalizada?: () => void
}

interface CarrinhoItem {
  produto: Produto
  quantidade: number
}

interface SelecaoFrete {
  tipoEntrega: TipoEntrega
  valorFrete: number
  prazoEntrega: string
  cepEntrega: string
}

interface CupomAplicado {
  codigo: string
  descricao: string | null
  tipoDesconto: 'percentual' | 'fixo'
  valor: number
  desconto: number
  influenciadorNome: string | null
}

export function ClientStore({ onCompraFinalizada }: ClientStoreProps) {
  const cartTrigger = useRef<HTMLButtonElement>(null)
  const cartRevision = useRef(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')
  const [loading, setLoading] = useState(true)
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [observacoes, setObservacoes] = useState('')
  const [finalizando, setFinalizando] = useState(false)
  const [cepCliente, setCepCliente] = useState<string | null>(null)
  const [enderecoEntrega, setEnderecoEntrega] = useState('')
  const [freteSelecionado, setFreteSelecionado] = useState<SelecaoFrete | null>(null)
  const [cupomCodigo, setCupomCodigo] = useState('')
  const [cupomAplicado, setCupomAplicado] = useState<CupomAplicado | null>(null)
  const [validandoCupom, setValidandoCupom] = useState(false)
  const [vendaEmPagamento, setVendaEmPagamento] = useState<Venda | null>(null)
  const [sucessoVisivel, setSucessoVisivel] = useState(false)
  const [siggmaOrderWriteConfigured, setSiggmaOrderWriteConfigured] = useState(false)

  useEffect(() => {
    let active = true
    const carregar = async () => {
      try {
        const [res, lojaStatus] = await Promise.all([
          fetch('/api/cliente/produtos', { credentials: 'same-origin' }),
          fetch('/api/cliente/loja/status', { credentials: 'same-origin', cache: 'no-store' }),
        ])
        if (res.ok && active) setProdutos(await res.json())
        if (lojaStatus.ok && active) {
          const status = await lojaStatus.json()
          setSiggmaOrderWriteConfigured(Boolean(status?.siggmaOrderWriteConfigured))
        }
        const meRes = await fetch('/api/auth/me', { credentials: 'same-origin' })
        if (meRes.ok && active) {
          const me = await meRes.json()
          setCepCliente(me?.user?.cliente?.cep || null)
          setEnderecoEntrega(me?.user?.cliente?.endereco || '')
        }
      } catch (e) {
        console.error('store carregar erro:', e)
      } finally {
        if (active) setLoading(false)
      }
    }
    void carregar()
    return () => { active = false }
  }, [refreshKey])

  const categorias = useMemo(
    () => [...new Set(produtos.map((produto) => produto.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [produtos]
  )

  const produtosFiltrados = useMemo(
    () => categoriaFiltro === 'todas' ? produtos : produtos.filter((produto) => produto.categoria === categoriaFiltro),
    [produtos, categoriaFiltro]
  )

  const subtotal = useMemo(
    () => carrinho.reduce(
      (acc, i) => acc + (i.produto.precoPromo ?? i.produto.preco) * i.quantidade,
      0
    ),
    [carrinho]
  )
  const valorFrete = freteSelecionado?.valorFrete ?? 0
  const descontoCupom = cupomAplicado?.desconto ?? 0
  const carrinhoTemZetta = carrinho.some((item) => Boolean(item.produto.zettaProCod))
  const checkoutZettaBloqueado = carrinhoTemZetta && !siggmaOrderWriteConfigured
  const total = Math.max(0, subtotal - descontoCupom) + valorFrete
  const fmtMoeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const adicionarAoCarrinho = (produto: Produto) => {
    const quantidade = carrinho.find((item) => item.produto.id === produto.id)?.quantidade ?? 0
    if (quantidade >= produto.estoque) return toast.error('Estoque máximo atingido')
    cartRevision.current += 1
    setCupomAplicado(null)
    setCarrinho((prev) => {
      const exists = prev.find((i) => i.produto.id === produto.id)
      if (exists) {
        if (exists.quantidade >= produto.estoque) {
          return prev
        }
        return prev.map((i) => i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      }
      return [...prev, { produto, quantidade: 1 }]
    })
    toast.success(`${produto.nome} adicionado`)
  }

  const alterarQtd = (produtoId: string, delta: number) => {
    cartRevision.current += 1
    setCupomAplicado(null)
    setCarrinho((prev) => prev
      .map((i) => {
        if (i.produto.id !== produtoId) return i
        const novaQ = i.quantidade + delta
        if (novaQ <= 0) return null
        if (novaQ > i.produto.estoque) {
          return i
        }
        return { ...i, quantidade: novaQ }
      })
      .filter(Boolean) as CarrinhoItem[])
  }

  const removerItem = (produtoId: string) => {
    cartRevision.current += 1
    setCupomAplicado(null)
    if (carrinho.length === 1) setFreteSelecionado(null)
    setCarrinho((prev) => prev.filter((i) => i.produto.id !== produtoId))
  }

  const aplicarCupom = async () => {
    if (validandoCupom) return
    const revision = cartRevision.current
    const codigo = cupomCodigo.trim().toUpperCase()
    if (codigo.length < 3) return toast.error('Digite um código de cupom válido.')
    if (subtotal <= 0) return toast.error('Adicione produtos antes de aplicar o cupom.')

    setValidandoCupom(true)
    try {
      const res = await fetch('/api/cupons/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ codigo, subtotal }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Cupom inválido.')
      if (revision !== cartRevision.current) {
        toast.info('O carrinho mudou. Aplique o cupom novamente.')
        return
      }
      setCupomCodigo(data.cupom.codigo)
      setCupomAplicado(data.cupom)
      toast.success(`Cupom ${data.cupom.codigo} aplicado: ${fmtMoeda(data.cupom.desconto)} de desconto.`)
    } catch (e) {
      setCupomAplicado(null)
      toast.error(e instanceof Error ? e.message : 'Não foi possível validar o cupom.')
    } finally {
      setValidandoCupom(false)
    }
  }

  const removerCupom = () => {
    setCupomAplicado(null)
    setCupomCodigo('')
  }

  const finalizarCompra = async () => {
    if (finalizando) return
    if (carrinho.length === 0) return toast.error('Carrinho vazio')
    if (checkoutZettaBloqueado) {
      return toast.error('A venda online dos produtos do ERP aguarda a liberação do endpoint de pedidos da Zetta.')
    }
    if (!freteSelecionado) return toast.error('Selecione uma opção de entrega')
    if (
      (freteSelecionado.tipoEntrega === 'entrega_propria' || freteSelecionado.tipoEntrega === 'sedex') &&
      !enderecoEntrega.trim()
    ) return toast.error('Informe o endereço de entrega')

    setFinalizando(true)
    try {
      const res = await fetch('/api/cliente/carrinho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          itens: carrinho.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade })),
          observacoes: observacoes || null,
          tipoEntrega: freteSelecionado.tipoEntrega,
          cepEntrega: freteSelecionado.cepEntrega,
          enderecoEntrega: freteSelecionado.tipoEntrega === 'retirada' ? null : enderecoEntrega.trim(),
          cupomCodigo: cupomAplicado?.codigo || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Erro ao finalizar')
      }
      setVendaEmPagamento(await res.json())
      toast.info('Pedido criado! Escolha a forma de pagamento abaixo.')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao finalizar compra')
    } finally {
      setFinalizando(false)
    }
  }

  const onPagamentoAprovado = () => {
    toast.success('Pagamento aprovado! Compra realizada com sucesso.')
    setSucessoVisivel(true)
    setCarrinho([])
    setObservacoes('')
    setFreteSelecionado(null)
    setCupomAplicado(null)
    setCupomCodigo('')
    setVendaEmPagamento(null)
    setCheckoutOpen(false)
    onCompraFinalizada?.()
    setRefreshKey((value) => value + 1)
    setTimeout(() => setSucessoVisivel(false), 2500)
  }

  const cancelarPagamento = () => {
    setVendaEmPagamento(null)
    setCheckoutOpen(false)
    toast.info('Checkout cancelado — sua venda ficou como pendente.')
  }

  const requiresEndereco = freteSelecionado?.tipoEntrega === 'entrega_propria' || freteSelecionado?.tipoEntrega === 'sedex'
  const whatsappLoja = matilhaWhatsAppUrl('Olá! Preciso de ajuda com uma compra na loja da Matilha Prado.')

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="page-heading">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Loja</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Produtos premium para o seu pet</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="h-9 sm:h-10 shrink-0">
            <a href={whatsappLoja} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          </Button>
          {carrinho.length > 0 && (
            <Button ref={cartTrigger} aria-label={`Abrir carrinho com ${carrinho.reduce((sum, item) => sum + item.quantidade, 0)} itens`} onClick={() => setCheckoutOpen(true)} className="btn-brand h-11 shrink-0">
              <ShoppingCart className="size-4" /><span className="hidden sm:inline">Carrinho</span> ({carrinho.reduce((sum, item) => sum + item.quantidade, 0)})
            </Button>
          )}
        </div>
      </div>

      {!loading && produtos.some((produto) => produto.zettaProCod) && !siggmaOrderWriteConfigured && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            O catálogo, preços e estoque já vêm do ERP Zetta em tempo real. A cobrança de produtos do ERP permanece bloqueada até a Zetta liberar o endpoint oficial de criação de pedidos, evitando divergência de estoque.
          </CardContent>
        </Card>
      )}

      {loading && <SkeletonLoader type="cards" count={8} />}

      {!loading && categorias.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar" aria-label="Categorias de produtos">
          <Button
            type="button"
            size="sm"
            variant={categoriaFiltro === 'todas' ? 'default' : 'outline'}
            onClick={() => setCategoriaFiltro('todas')}
            className="shrink-0"
          >
            Todas
          </Button>
          {categorias.map((categoria) => (
            <Button
              key={categoria}
              type="button"
              size="sm"
              variant={categoriaFiltro === categoria ? 'default' : 'outline'}
              onClick={() => setCategoriaFiltro(categoria)}
              className="shrink-0"
            >
              {categoria}
            </Button>
          ))}
        </div>
      )}

      <div className="stagger-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {produtosFiltrados.map((p) => (
          <Card key={p.id} className="product-card group card-hover overflow-hidden py-0">
            <CardContent className="p-4 flex h-full flex-col gap-4">
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.nome} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105" />
                ) : <Package className="size-12 text-muted-foreground/40" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base leading-snug line-clamp-2 min-h-11">{p.nome}</p>
                <p className="text-xs text-muted-foreground truncate">{p.categoria}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  {p.precoPromo ? (
                    <div><span className="text-xs line-through text-muted-foreground">{fmtMoeda(p.preco)}</span><p className="font-bold text-primary text-sm sm:text-base">{fmtMoeda(p.precoPromo)}</p></div>
                  ) : <p className="font-bold text-sm sm:text-base">{fmtMoeda(p.preco)}</p>}
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">Est: {p.estoque}</Badge>
              </div>
              <Button size="sm" onClick={() => adicionarAoCarrinho(p)} disabled={p.estoque <= 0} className="btn-brand h-11">
                <Plus className="size-3.5" /> Adicionar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && produtos.length === 0 && (
        <Card><CardContent className="p-8 sm:p-12 text-center"><Package className="size-12 text-muted-foreground/40 mx-auto mb-3" /><p className="text-muted-foreground">Nenhum produto disponível no momento.</p></CardContent></Card>
      )}

      <Sheet open={checkoutOpen} onOpenChange={(open) => {
        if (finalizando) return
        setCheckoutOpen(open)
        if (!open) setFreteSelecionado(null)
      }}>
            <SheetContent
              className="cart-sheet w-full sm:max-w-lg gap-0 overflow-hidden [&>button]:size-11 [&>button]:top-3 [&>button]:right-3 [&>button]:flex [&>button]:items-center [&>button]:justify-center"
              onInteractOutside={(event) => { if (vendaEmPagamento || finalizando) event.preventDefault() }}
              onCloseAutoFocus={(event) => { event.preventDefault(); cartTrigger.current?.focus() }}
            >
              <CardHeader className="shrink-0 border-b bg-muted/30 p-5 pr-16">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <SheetTitle className="flex items-center gap-2 text-lg">
                      {vendaEmPagamento ? (sucessoVisivel ? <><PartyPopper className="size-5 text-green-600" /> Compra realizada!</> : <><Sparkles className="size-5 text-primary" /> Pagamento</>) : <><ShoppingCart className="size-5" /> Seu carrinho</>}
                    </SheetTitle>
                    <SheetDescription className="mt-1">Confira os produtos, a entrega e o pagamento.</SheetDescription>
                    {!vendaEmPagamento && carrinho.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">{carrinho.reduce((acc, item) => acc + item.quantidade, 0)} item(ns) selecionado(s)</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <div className="custom-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5">
              {sucessoVisivel ? (
                <div className="text-center py-6 space-y-3"><div className="size-16 rounded-full bg-green-100 text-green-600 mx-auto flex items-center justify-center"><CheckCircle2 className="size-10" /></div><p className="font-bold text-green-700">Compra realizada com sucesso!</p><p className="text-xs text-muted-foreground">Você receberá atualizações por aqui mesmo.</p></div>
              ) : vendaEmPagamento ? (
                <>
                  <Button variant="ghost" size="sm" className="h-11 text-sm mb-1" onClick={() => { setVendaEmPagamento(null); setFreteSelecionado(null) }}><ArrowLeft className="size-4" /> Voltar ao carrinho</Button>
                  <PagamentoCheckout vendaId={vendaEmPagamento.id} total={vendaEmPagamento.total} onAprovado={onPagamentoAprovado} onCancelar={cancelarPagamento} />
                </>
              ) : carrinho.length === 0 ? (
                <div className="py-12 text-center space-y-4"><ShoppingCart className="size-12 mx-auto text-primary/50" /><p className="text-lg font-semibold">Seu carrinho está vazio</p><p className="text-sm text-muted-foreground">Escolha algo especial para o seu pet.</p><Button variant="outline" className="h-11" onClick={() => setCheckoutOpen(false)}>Continuar comprando</Button></div>
              ) : (
                <>
                  <div className="space-y-2">
                    {carrinho.map((i) => (
                      <div key={i.produto.id} className="rounded-xl border border-border p-3">
                        <div className="flex items-start gap-3">
                          <div className="size-12 bg-muted rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                            {i.produto.imageUrl ? <img src={i.produto.imageUrl} alt={i.produto.nome} className="w-full h-full object-cover" /> : <Package className="size-5 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-snug line-clamp-2">{i.produto.nome}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{fmtMoeda(i.produto.precoPromo ?? i.produto.preco)} cada</p>
                          </div>
                          <Button size="icon" variant="ghost" className="size-11 shrink-0 text-destructive" onClick={() => removerItem(i.produto.id)} aria-label={`Remover ${i.produto.nome}`}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex items-center rounded-lg border bg-background">
                            <Button size="icon" variant="ghost" className="size-11 rounded-r-none" aria-label={`Diminuir quantidade de ${i.produto.nome}`} disabled={i.quantidade <= 1 || finalizando} onClick={() => alterarQtd(i.produto.id, -1)}><Minus className="size-4" /></Button>
                            <span aria-live="polite" className="w-8 text-center text-sm font-semibold tabular-nums">{i.quantidade}</span>
                            <Button size="icon" variant="ghost" className="size-11 rounded-l-none" aria-label={`Aumentar quantidade de ${i.produto.nome}`} disabled={i.quantidade >= i.produto.estoque || finalizando} onClick={() => alterarQtd(i.produto.id, 1)}><Plus className="size-4" /></Button>
                          </div>
                          <p className="text-sm font-bold">{fmtMoeda((i.produto.precoPromo ?? i.produto.preco) * i.quantidade)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex items-center gap-2"><TicketPercent className="size-4 text-primary" /><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cupom de desconto</p></div>
                    <div className="flex gap-2">
                      <Input
                        value={cupomCodigo}
                        onChange={(e) => { setCupomCodigo(e.target.value.toUpperCase()); if (cupomAplicado) setCupomAplicado(null) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void aplicarCupom() } }}
                        placeholder="Ex.: MATILHA10"
                        maxLength={30}
                        aria-label="Código do cupom de desconto"
                        className="min-w-0 h-11 uppercase font-mono"
                        disabled={validandoCupom}
                      />
                      <Button type="button" variant="outline" onClick={() => void aplicarCupom()} disabled={validandoCupom || cupomCodigo.trim().length < 3}>
                        {validandoCupom ? <Loader2 className="size-4 animate-spin" /> : 'Aplicar'}
                      </Button>
                    </div>
                    {cupomAplicado && (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-800">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><p className="text-sm font-semibold">{cupomAplicado.codigo} aplicado</p><p className="text-xs">Você economizou {fmtMoeda(cupomAplicado.desconto)}.{cupomAplicado.influenciadorNome ? ` Indicação de ${cupomAplicado.influenciadorNome}.` : ''}</p></div>
                          <Button type="button" size="icon" variant="ghost" className="size-7 text-green-800" onClick={removerCupom} aria-label="Remover cupom"><X className="size-4" /></Button>
                        </div>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">O desconto é aplicado aos produtos. O frete não entra no cálculo.</p>
                  </div>

                  <div className="border-t border-border pt-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Entrega</p>
                    <FreteCalculator cepInicial={cepCliente} onSelect={(info) => setFreteSelecionado(info)} onClear={() => setFreteSelecionado(null)} compact />
                  </div>

                  {requiresEndereco && (
                    <div><Label htmlFor="end-entrega">Endereço de entrega</Label><Input id="end-entrega" placeholder="Rua, número, complemento, bairro" value={enderecoEntrega} onChange={(e) => setEnderecoEntrega(e.target.value)} /><p className="text-[11px] text-muted-foreground mt-1">Usaremos o CEP informado acima para calcular o frete.</p></div>
                  )}

                  <div><Label htmlFor="obs">Observações (opcional)</Label><Textarea id="obs" rows={2} placeholder="Instruções para entrega, retirada..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>

                  <div className="border-t border-border pt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{fmtMoeda(subtotal)}</span></div>
                    {descontoCupom > 0 && <div className="flex items-center justify-between text-sm text-green-700"><span>Desconto ({cupomAplicado?.codigo})</span><span>- {fmtMoeda(descontoCupom)}</span></div>}
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Frete</span><span>{freteSelecionado ? (freteSelecionado.valorFrete === 0 ? 'Grátis' : fmtMoeda(freteSelecionado.valorFrete)) : '—'}</span></div>
                    <div className="flex items-center justify-between text-lg font-bold pt-1"><span>Total</span><span className="text-primary">{fmtMoeda(total)}</span></div>
                  </div>

                  {checkoutZettaBloqueado && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-semibold">Compra online temporariamente bloqueada</p>
                      <p className="mt-1 text-xs leading-relaxed">O estoque e o preço vêm do Zetta, mas ainda aguardamos a API oficial de pedidos para registrar a venda sem divergência.</p>
                      <Button asChild variant="outline" size="sm" className="mt-3 bg-white">
                        <a href={whatsappLoja} target="_blank" rel="noreferrer">
                          <MessageCircle className="size-4" /> Falar no WhatsApp
                        </a>
                      </Button>
                    </div>
                  )}

                </>
              )}
              </div>
              {!vendaEmPagamento && carrinho.length > 0 && (
                <div className="cart-footer shrink-0 border-t bg-background p-4 space-y-3 sm:p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm text-muted-foreground">{freteSelecionado ? 'Total da compra' : 'Subtotal · frete a calcular'}</span><strong className="text-xl text-primary tabular-nums">{fmtMoeda(total)}</strong></div>
                  <Button
                    className="w-full btn-brand min-h-12 h-auto whitespace-normal py-3 text-sm"
                    onClick={finalizarCompra}
                    disabled={finalizando || !freteSelecionado || checkoutZettaBloqueado}
                  >
                    <CheckCircle2 className="size-4" />
                    {finalizando
                      ? 'Processando...'
                      : checkoutZettaBloqueado
                        ? 'Compra online indisponível'
                        : !freteSelecionado
                          ? 'Selecione uma opção de entrega'
                          : 'Confirmar compra'}
                  </Button>
                </div>
              )}
            </SheetContent>
      </Sheet>
    </div>
  )
}
