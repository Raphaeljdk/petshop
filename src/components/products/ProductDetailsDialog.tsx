'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  ExternalLink,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'
import { ProductReviews } from './ProductReviews'

export type ProductPreview = {
  id: string
  nome: string
  descricao?: string | null
  categoria: string
  preco: number
  precoPromo: number | null
  estoque: number
  estoqueIlimitado?: boolean
  imageUrl: string | null
  origem?: 'mercado_livre' | 'amazon' | 'zetta' | 'hub'
  marketplaceUrl?: string | null
}

type ProductDetails = ProductPreview & {
  imagens: string[]
  marca?: string | null
  modelo?: string | null
  peso?: string | number | null
  altura?: string | number | null
  largura?: string | number | null
  comprimento?: string | number | null
  sku?: string | null
}

type ProductDetailsDialogProps = {
  product: ProductPreview | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddToCart?: (product: ProductPreview, quantity: number) => void
  onLoginToBuy?: () => void
}

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function ProductDetailsDialog({
  product,
  open,
  onOpenChange,
  onAddToCart,
  onLoginToBuy,
}: ProductDetailsDialogProps) {
  const [details, setDetails] = useState<ProductDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!open || !product) return

    let active = true
    // Reset state for the product being opened; the effect also starts the remote detail fetch.
    setLoading(true)
    setSelectedImage(0)
    setQuantity(1)
    setDetails({
      ...product,
      imagens: product.imageUrl ? [product.imageUrl] : [],
    })

    void fetch(`/api/public/produtos/${encodeURIComponent(product.id)}`, {
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload) throw new Error(payload?.error || 'Falha ao carregar produto.')
        return payload as ProductDetails
      })
      .then((payload) => {
        if (!active) return
        setDetails(payload)
        setSelectedImage(0)
      })
      .catch((error) => {
        console.error('product details:', error)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [open, product])

  const current = details || (product ? { ...product, imagens: product.imageUrl ? [product.imageUrl] : [] } : null)
  const images = current?.imagens?.filter(Boolean) || []
  const currentImage = images[selectedImage] || current?.imageUrl || null
  const currentPrice = current ? current.precoPromo ?? current.preco : 0
  const hasPromo = Boolean(
    current &&
      current.precoPromo != null &&
      current.precoPromo > 0 &&
      current.precoPromo < current.preco
  )

  const specs = !current
    ? []
    : ([
        current.marca ? ['Marca', current.marca] : null,
        current.modelo ? ['Modelo', current.modelo] : null,
        current.peso ? ['Peso', String(current.peso)] : null,
        current.altura ? ['Altura', String(current.altura)] : null,
        current.largura ? ['Largura', String(current.largura)] : null,
        current.comprimento
          ? ['Comprimento', String(current.comprimento)]
          : null,
      ].filter(Boolean) as Array<[string, string]>)

  if (!product) return null

  const changeImage = (direction: number) => {
    if (images.length <= 1) return
    setSelectedImage((index) => (index + direction + images.length) % images.length)
  }

  const whatsapp = matilhaWhatsAppUrl(
    `Olá! Vi o produto "${current?.nome || product.nome}" no site da Matilha Prado e gostaria de mais informações.`
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="product-details-dialog left-3 right-3 top-[max(.75rem,env(safe-area-inset-top))] bottom-[max(.75rem,env(safe-area-inset-bottom))] h-auto w-auto max-h-none max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-[1.4rem] border-border/70 bg-background p-0 shadow-2xl sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:h-[min(92dvh,900px)] sm:w-[calc(100vw-2rem)] sm:max-w-[1400px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.75rem]">
        <DialogTitle className="sr-only">Detalhes do produto</DialogTitle>
        <DialogDescription className="sr-only">
          Fotos, descrição, preço, estoque e informações do produto selecionado.
        </DialogDescription>

        <div className="product-details-layout h-full w-full min-w-0 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(420px,0.88fr)] lg:overflow-hidden">
          <div className="min-w-0 border-b bg-slate-50/70 p-3 pt-4 sm:p-5 lg:flex lg:min-h-0 lg:flex-col lg:border-b-0 lg:border-r lg:p-6 xl:p-8">
            <div
              className="product-gallery relative aspect-[4/3] w-full max-w-full overflow-hidden rounded-[1.15rem] border border-border/60 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-primary sm:rounded-2xl lg:min-h-0 lg:flex-1 lg:aspect-auto"
              role="region"
              aria-label="Fotos do produto. Use as setas para navegar."
              tabIndex={images.length > 1 ? 0 : undefined}
              onKeyDown={event => {
                if (event.target !== event.currentTarget) return
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); changeImage(event.key === 'ArrowLeft' ? -1 : 1) }
              }}
              onTouchStart={(event) => {
                const touch = event.touches.length === 1 ? event.touches[0] : null
                touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
              }}
              onTouchCancel={() => { touchStart.current = null }}
              onTouchEnd={(event) => {
                const start = touchStart.current
                const end = event.changedTouches[0]
                touchStart.current = null
                if (!start || !end) return
                const delta = end.clientX - start.x
                if (Math.abs(delta) < 45 || Math.abs(delta) <= Math.abs(end.clientY - start.y)) return
                changeImage(delta > 0 ? -1 : 1)
              }}
            >
              {currentImage ? (
                <img
                  src={currentImage}
                  alt={current?.nome || product.nome}
                  className="h-full w-full object-contain p-3 sm:p-4 lg:p-5"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Package className="size-20 text-muted-foreground/25" />
                </div>
              )}

              {images.length > 1 && (
                <Badge role="status" aria-label={`Foto ${selectedImage + 1} de ${images.length}`} className="absolute right-3 top-3 z-10 bg-slate-950/70 text-white hover:bg-slate-950/70">
                  {selectedImage + 1} / {images.length}
                </Badge>
              )}

              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              )}

              {images.length > 1 && (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute left-2 top-1/2 size-9 -translate-y-1/2 rounded-full border border-white/70 bg-white/90 shadow-md backdrop-blur sm:left-3 sm:size-10"
                    onClick={() => changeImage(-1)}
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-1/2 size-9 -translate-y-1/2 rounded-full border border-white/70 bg-white/90 shadow-md backdrop-blur sm:right-3 sm:size-10"
                    onClick={() => changeImage(1)}
                    aria-label="Próxima foto"
                  >
                    <ChevronRight className="size-5" />
                  </Button>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-4 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    className={[
                      'size-16 shrink-0 overflow-hidden rounded-xl border bg-white p-1 transition sm:size-20 lg:size-24',
                      selectedImage === index
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50',
                    ].join(' ')}
                    aria-label={`Ver foto ${index + 1}`}
                    aria-pressed={selectedImage === index}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="" className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            )}

            {images.length > 0 && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {images.length} {images.length === 1 ? 'foto disponível' : 'fotos disponíveis'}
              </p>
            )}
          </div>

          <div className="product-details-info flex min-w-0 flex-col bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-7 lg:min-h-0 lg:overflow-y-auto lg:p-8 xl:p-9">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{current?.categoria || product.categoria}</Badge>
              {current?.origem === 'mercado_livre' && (
                <Badge className="border-yellow-200 bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                  Mercado Livre
                </Badge>
              )}
              {current?.origem === 'amazon' && (
                <Badge className="border-sky-200 bg-sky-100 text-sky-800 hover:bg-sky-100">
                  Amazon
                </Badge>
              )}
              {hasPromo && <Badge className="bg-orange-500 text-white hover:bg-orange-500">Oferta</Badge>}
            </div>

            <h2 className="mt-3 break-words pr-10 text-[1.35rem] font-bold leading-[1.12] tracking-tight text-slate-950 sm:mt-4 sm:text-3xl lg:pr-6 lg:text-[2.05rem] xl:text-[2.2rem]">
              {current?.nome || product.nome}
            </h2>

            <div className="mt-4">
              {hasPromo && current && (
                <p className="text-sm text-muted-foreground line-through">{money(current.preco)}</p>
              )}
              <p className="text-[1.8rem] font-extrabold tracking-tight text-primary sm:text-4xl lg:text-[2.55rem]">{money(currentPrice)}</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Badge
                variant="outline"
                className={
                  current?.estoqueIlimitado || (current?.estoque || 0) > 0
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }
              >
                {current?.estoqueIlimitado
                  ? 'Estoque ilimitado'
                  : (current?.estoque || 0) > 0
                    ? `${current?.estoque} unidade(s) disponível(is)`
                    : 'Produto indisponível'}
              </Badge>
            </div>

            <div className="mt-5 rounded-2xl border border-border/60 bg-slate-50/60 p-4 sm:mt-6 sm:p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Descrição
              </h3>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-foreground/85 sm:text-[15px]">
                {current?.descricao?.trim() || 'Este produto não possui descrição adicional cadastrada no catálogo.'}
              </p>
            </div>

            {specs.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-2">
                {specs.map(([label, value]) => (
                  <div key={label} className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-medium">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {product && <ProductReviews key={product.id} productId={product.id} />}

            <div className="mt-6 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-5 lg:sticky lg:bottom-0 lg:z-10 lg:mt-auto lg:bg-background/95 lg:backdrop-blur">
              {onAddToCart ? (
                <div className="grid gap-3 sm:grid-cols-[132px_minmax(0,1fr)]">
                  <div className="flex h-12 min-w-0 items-center justify-between rounded-xl border bg-background">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-11 rounded-r-none"
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                      disabled={quantity <= 1}
                      aria-label="Diminuir quantidade"
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-10 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-11 rounded-l-none"
                      onClick={() =>
                        setQuantity((value) =>
                          current?.estoqueIlimitado
                            ? Math.min(99, value + 1)
                            : Math.min(current?.estoque || 1, value + 1)
                        )
                      }
                      disabled={
                        current?.estoqueIlimitado
                          ? quantity >= 99
                          : quantity >= (current?.estoque || 0)
                      }
                      aria-label="Aumentar quantidade"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>

                  <Button
                    className="btn-brand h-12 min-w-0 w-full px-4 text-sm font-semibold shadow-sm xl:text-base"
                    disabled={!current?.estoqueIlimitado && (current?.estoque || 0) <= 0}
                    onClick={() => {
                      if (!current) return
                      onAddToCart(current, quantity)
                      onOpenChange(false)
                    }}
                  >
                    <ShoppingCart className="size-4" />
                    Adicionar ao carrinho
                  </Button>
                </div>
              ) : (
                <Button
                  className="btn-brand h-12 w-full text-base font-semibold shadow-sm"
                  disabled={!current?.estoqueIlimitado && (current?.estoque || 0) <= 0}
                  onClick={() => {
                    onOpenChange(false)
                    onLoginToBuy?.()
                  }}
                >
                  <ShoppingCart className="size-4" />
                  Entrar para comprar
                </Button>
              )}

              {current?.marketplaceUrl && (
                <Button asChild variant="outline" className="mt-3 h-11 w-full min-w-0 justify-center px-3 font-medium">
                  <a
                    href={current.marketplaceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="size-4 shrink-0" />
                    <span className="truncate">Ver anúncio {current?.origem === 'amazon' ? 'na Amazon' : 'no Mercado Livre'}</span>
                  </a>
                </Button>
              )}

              <Button asChild variant="outline" className="mt-3 h-11 w-full min-w-0 justify-center px-3">
                <a href={whatsapp} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4 shrink-0" />
                  <span className="truncate">Perguntar sobre este produto</span>
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
