'use client'

import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { FreteCalculator } from '@/components/cliente-portal/FreteCalculator'
import { PagamentoCheckout } from '@/components/cliente-portal/PagamentoCheckout'
import { toast } from 'sonner'
import type { Produto, TipoEntrega, Venda } from '@/lib/types'

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
  const [refreshKey, setRefreshKey] = useState(0)
  const [produtos, setProdutos] = useState<Produto[]>([])
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

  useEffect(() => {
    let active = true
    const carregar = async () => {
      try {
        const res = await fetch('/api/cliente/produtos', { credentials: 'same-origin' })
        if (res.ok && active) setProdutos(await res.json())
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

  const subtotal = useMemo(
    () => carrinho.reduce(
      (acc, i) => acc + (i.produto.precoPromo ?? i.produto.preco) * i.quantidade,
      0
    ),
    [carrinho]
  )
  const valorFrete = freteSelecionado?.valorFrete ?? 0
  const descontoCupom = cupomAplicado?.desconto ?? 0
  const total = Math.max(0, subtotal - descontoCupom) + valorFrete
  const fmtMoeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  useEffect(() => {
    setCupomAplicado(null)
  }, [subtotal])

  const adicionarAoCarrinho = (produto: Produto) => {
    setCarrinho((prev) => {
      const exists = prev.find((i) => i.produto.id === produto.id)
      if (exists) {
        if (exists.quantidade >= produto.estoque) {
          toast.error('Estoque máximo atingido')
          return prev
        }
        return prev.map((i) => i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      }
      return [...prev, { produto, quantidade: 1 }]
    })
    toast.success(`${produto.nome} adicionado`)
  }

  const alterarQtd = (produtoId: string, delta: number) => {
    setCarrinho((prev) => prev
      .map((i) => {
        if (i.produto.id !== produtoId) return i
        const novaQ = i.quantidade + delta
        if (novaQ <= 0) return null
        if (novaQ > i.produto.estoque) {
          toast.error('Estoque máximo atingido')
          return i
        }
        return { ...i, quantidade: novaQ }
      })
      .filter(Boolean) as CarrinhoItem[])
  }

  const removerItem = (produtoId: string) => {
    setCarrinho((prev) => prev.filter((i) => i.produto.id !== produtoId))
  }

  const aplicarCupom = async () => {
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
    if (carrinho.length === 0) return toast.error('Carrinho vazio')
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="page-heading">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Loja</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Produtos premium para o seu pet</p>
        </div>
        {carrinho.length > 0 && (
          <Button aria-label={`Abrir carrinho com ${carrinho.length} produtos`} onClick={() => setCheckoutOpen(true)} className="btn-brand h-9 sm:h-10 shrink-0">
            <ShoppingCart className="size-4" /><span className="hidden sm:inline">Carrinho</span> ({carrinho.length})
          </Button>
        )}
      </div>

      {loading && <SkeletonLoader type="cards" count={8} />}

      <div className="stagger-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {produtos.map((p) => (
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

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => { if (!vendaEmPagamento) setCheckoutOpen(false) }}>
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl custom-scrollbar" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                {vendaEmPagamento ? (sucessoVisivel ? <><PartyPopper className="size-5 text-green-600" /> Compra realizada!</> : <><Sparkles className="size-5 text-primary" /> Pagamento</>) : <><ShoppingCart className="size-5" /> Finalizar compra</>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {sucessoVisivel ? (
                <div className="text-center py-6 space-y-3"><div className="size-16 rounded-full bg-green-100 text-green-600 mx-auto flex items-center justify-center"><CheckCircle2 className="size-10" /></div><p className="font-bold text-green-700">Compra realizada com sucesso!</p><p className="text-xs text-muted-foreground">Você receberá atualizações por aqui mesmo.</p></div>
              ) : vendaEmPagamento ? (
                <>
                  <Button variant="ghost" size="sm" className="h-7 text-xs mb-1 -mt-2" onClick={() => setVendaEmPagamento(null)}><ArrowLeft className="size-3.5" /> Voltar ao carrinho</Button>
                  <PagamentoCheckout vendaId={vendaEmPagamento.id} total={vendaEmPagamento.total} onAprovado={onPagamentoAprovado} onCancelar={cancelarPagamento} />
                </>
              ) : carrinho.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Seu carrinho está vazio.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {carrinho.map((i) => (
                      <div key={i.produto.id} className="flex items-center gap-2 sm:gap-3 p-2 border border-border rounded-lg">
                        <div className="size-10 bg-muted rounded flex items-center justify-center shrink-0">
                          {i.produto.imageUrl ? <img src={i.produto.imageUrl} alt={i.produto.nome} className="w-full h-full object-cover rounded" /> : <Package className="size-5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{i.produto.nome}</p><p className="text-xs text-muted-foreground">{fmtMoeda(i.produto.precoPromo ?? i.produto.preco)}</p></div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="icon" variant="outline" className="size-8" onClick={() => alterarQtd(i.produto.id, -1)}><Minus className="size-3" /></Button>
                          <span className="text-sm font-semibold w-6 text-center">{i.quantidade}</span>
                          <Button size="icon" variant="outline" className="size-8" onClick={() => alterarQtd(i.produto.id, 1)}><Plus className="size-3" /></Button>
                          <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => removerItem(i.produto.id)}><Trash2 className="size-3.5" /></Button>
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
                        className="uppercase font-mono"
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

                  <Button className="w-full btn-brand h-11" onClick={finalizarCompra} disabled={finalizando || !freteSelecionado}>
                    <CheckCircle2 className="size-4" />{finalizando ? 'Processando...' : !freteSelecionado ? 'Selecione uma opção de entrega' : 'Confirmar compra'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
