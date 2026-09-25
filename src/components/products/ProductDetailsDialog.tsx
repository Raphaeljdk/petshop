'use client'

import { useEffect, useMemo, useState } from 'react'
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

export type ProductPreview = {
  id: string
  nome: string
  descricao?: string | null
  categoria: string
  preco: number
  precoPromo: number | null
  estoque: number
  imageUrl: string | null
  origem?: 'mercado_livre' | 'zetta' | 'hub'
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

  useEffect(() => {
    if (!open || !product) return

    let active = true
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

  const specs = useMemo(() => {
    if (!current) return []

    return [
      current.marca ? ['Marca', current.marca] : null,
      current.modelo ? ['Modelo', current.modelo] : null,
      current.peso ? ['Peso', String(current.peso)] : null,
      current.altura ? ['Altura', String(current.altura)] : null,
      current.largura ? ['Largura', String(current.largura)] : null,
      current.comprimento ? ['Comprimento', String(current.comprimento)] : null,
    ].filter(Boolean) as Array<[string, string]>
  }, [current])

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
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-5xl">
        <DialogTitle className="sr-only">Detalhes do produto</DialogTitle>
        <DialogDescription className="sr-only">
          Fotos, descrição, preço, estoque e informações do produto selecionado.
        </DialogDescription>

        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="border-b bg-muted/20 p-4 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-white">
              {currentImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentImage}
                  alt={current?.nome || product.nome}
                  className="h-full w-full object-contain p-3 sm:p-5"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Package className="size-20 text-muted-foreground/25" />
                </div>
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
                    className="absolute left-3 top-1/2 size-10 -translate-y-1/2 rounded-full shadow"
                    onClick={() => changeImage(-1)}
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-3 top-1/2 size-10 -translate-y-1/2 rounded-full shadow"
                    onClick={() => changeImage(1)}
                    aria-label="Próxima foto"
                  >
                    <ChevronRight className="size-5" />
                  </Button>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    className={[
                      'size-20 shrink-0 overflow-hidden rounded-xl border bg-white p-1 transition',
                      selectedImage === index
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50',
                    ].join(' ')}
                    aria-label={`Ver foto ${index + 1}`}
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

          <div className="flex flex-col p-5 sm:p-7">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{current?.categoria || product.categoria}</Badge>
              {current?.origem === 'mercado_livre' && (
                <Badge className="border-yellow-200 bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                  Mercado Livre
                </Badge>
              )}
              {hasPromo && <Badge className="bg-orange-500 text-white hover:bg-orange-500">Oferta</Badge>}
            </div>

            <h2 className="mt-4 text-2xl font-bold leading-tight sm:text-3xl">
              {current?.nome || product.nome}
            </h2>

            <div className="mt-4">
              {hasPromo && current && (
                <p className="text-sm text-muted-foreground line-through">{money(current.preco)}</p>
              )}
              <p className="text-2xl font-bold text-primary">{money(currentPrice)}</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Badge
                variant="outline"
                className={
                  (current?.estoque || 0) > 0
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }
              >
                {(current?.estoque || 0) > 0
                  ? `${current?.estoque} unidade(s) disponível(is)`
                  : 'Produto indisponível'}
              </Badge>
            </div>

            <div className="mt-6 border-t pt-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Descrição
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-foreground/80">
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

            <div className="mt-auto pt-7">
              {onAddToCart ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex h-12 items-center rounded-xl border bg-background">
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
                        setQuantity((value) => Math.min(current?.estoque || 1, value + 1))
                      }
                      disabled={quantity >= (current?.estoque || 0)}
                      aria-label="Aumentar quantidade"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>

                  <Button
                    className="btn-brand h-12 flex-1"
                    disabled={(current?.estoque || 0) <= 0}
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
                  className="btn-brand h-12 w-full"
                  disabled={(current?.estoque || 0) <= 0}
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
                <Button asChild variant="outline" className="mt-3 h-11 w-full">
                  <a
                    href={current.marketplaceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="size-4" />
                    Ver anúncio no Mercado Livre
                  </a>
                </Button>
              )}

              <Button asChild variant="outline" className="mt-3 h-11 w-full">
                <a href={whatsapp} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" />
                  Perguntar sobre este produto
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
