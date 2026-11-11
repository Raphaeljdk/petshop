'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, Check, Grid2X2, Loader2, Package, ShoppingBag, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'
import { isClothingProduct } from '@/lib/product-variants'
import { getProductBrand, SEM_MARCA } from '@/lib/product-brands'
import {
  ProductDetailsDialog,
  type ProductPreview,
} from '@/components/products/ProductDetailsDialog'

type PublicProduct = ProductPreview

export function PublicProducts({ onBuy }: { onBuy: () => void }) {
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [brand, setBrand] = useState('todas')
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const resultsRef = useRef<HTMLHeadingElement>(null)

  function selectBrand(nextBrand: string) {
    setBrand(nextBrand)
    window.requestAnimationFrame(() => {
      const heading = resultsRef.current
      if (!heading) return
      heading.focus({ preventScroll: true })
      heading.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      })
    })
  }

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        section.dataset.inView = 'true'
        observer.disconnect()
      }
    }, { threshold: 0.08 })
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true

    void fetch('/api/public/produtos', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Falha ao carregar a vitrine.')
        return response.json()
      })
      .then((payload) => {
        if (active) setProducts(Array.isArray(payload) ? payload : [])
      })
      .catch((error) => console.error('public products:', error))
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const brandOptions = useMemo(() => {
    const grouped = new Map<string, { label: string; count: number; imageUrl: string | null }>()
    for (const product of products) {
      const label = getProductBrand(product)
      const current = grouped.get(label) || { label, count: 0, imageUrl: null }
      current.count += 1
      if (!current.imageUrl && product.imageUrl) current.imageUrl = product.imageUrl
      grouped.set(label, current)
    }
    return [...grouped.values()].sort((a, b) =>
      a.label === SEM_MARCA ? 1 : b.label === SEM_MARCA ? -1 : a.label.localeCompare(b.label, 'pt-BR')
    )
  }, [products])

  const visible = useMemo(() => {
    const filtered = brand === 'todas'
      ? products
      : products.filter((product) => getProductBrand(product) === brand)

    return [...filtered]
      .sort((a, b) => {
        const aSemEstoque = !a.estoqueIlimitado && a.estoque <= 0
        const bSemEstoque = !b.estoqueIlimitado && b.estoque <= 0
        return aSemEstoque === bSemEstoque ? 0 : aSemEstoque ? 1 : -1
      })
      .slice(0, 12)
  }, [products, brand])

  const money = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const whatsapp = matilhaWhatsAppUrl(
    'Olá! Vi os produtos no site da Matilha Prado e gostaria de ajuda para escolher um produto para o meu pet.'
  )

  return (
    <section ref={sectionRef} id="produtos" className="boutique-section pt-8 pb-14 sm:pt-10 sm:pb-18 lg:pt-12 lg:pb-24" aria-labelledby="boutique-title">
      <div className="container relative mx-auto px-4">
        <div className="boutique-heading mx-auto mb-8 max-w-3xl text-center sm:mb-10">
          <Badge variant="secondary" className="boutique-eyebrow mb-5">
            <ShoppingBag className="size-3.5" />
            Boutique Matilha Prado
          </Badge>
          <h2 id="boutique-title" className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Pequenos mimos.<br /><span className="boutique-title-accent">Muito amor pelo seu pet.</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Do cuidado à diversão, encontre o próximo favorito da sua matilha.
            Escolha uma marca e explore a vitrine.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Carregando produtos...
          </div>
        ) : products.length === 0 ? (
          <Card className="mx-auto max-w-xl border-dashed">
            <CardContent className="p-8 text-center">
              <Package className="mx-auto mb-3 size-10 text-muted-foreground/40" />
              <p className="font-medium">A vitrine está sendo atualizada</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Fale com a Matilha Prado para consultar os produtos disponíveis agora.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <a href={whatsapp} target="_blank" rel="noreferrer">
                  Consultar pelo WhatsApp
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-8 flex gap-3 overflow-x-auto pb-3" role="group" aria-label="Filtrar vitrine por marca">
              <button type="button" className="boutique-category boutique-category-all min-w-36 shrink-0" aria-pressed={brand === 'todas'} aria-controls="boutique-results" onClick={() => selectBrand('todas')} style={{ '--category-order': 0 } as CSSProperties}>
                <span className="boutique-category-art"><Grid2X2 className="size-9 sm:size-11" aria-hidden="true" /></span>
                <span className="boutique-category-name">Todas as marcas</span>
                <span className="boutique-category-hint">Toda a coleção <ArrowRight className="size-3.5" aria-hidden="true" /></span>
                {brand === 'todas' && <Check className="boutique-category-check size-5" aria-hidden="true" />}
              </button>
              {brandOptions.map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={brand === option.label}
                  aria-controls="boutique-results"
                  onClick={() => selectBrand(option.label)}
                  className="group boutique-category min-w-36 shrink-0"
                  style={{ '--category-order': index + 1 } as CSSProperties}
                >
                  <span className="boutique-category-art bg-muted">
                    {option.imageUrl ? (
                      <img src={option.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <Package className="size-9 sm:size-11" strokeWidth={1.5} aria-hidden="true" />
                    )}
                  </span>
                  <span className="boutique-category-name">{option.label}</span>
                  <span className="boutique-category-hint">{option.count} {option.count === 1 ? 'produto' : 'produtos'} <ArrowRight className="size-3.5" aria-hidden="true" /></span>
                  {brand === option.label && <Check className="boutique-category-check size-5" aria-hidden="true" />}
                </button>
              ))}
            </div>

            <div className="mb-6 flex items-center justify-between gap-3">
              <div role="status" aria-live="polite">
                <h3 ref={resultsRef} id="boutique-results" tabIndex={-1} className="scroll-mt-28 rounded-sm text-sm font-semibold">
                  {brand !== 'todas' ? brand : 'Todos os produtos'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedShortcut
                    ? 'Mostrando itens relacionados à categoria selecionada.'
                    : 'Selecione uma categoria acima para filtrar.'}
                </p>
              </div>
              {brand !== 'todas' && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => selectBrand('todas')}
                >
                  Ver todos
                </Button>
              )}
            </div>

            {visible.length === 0 ? (
              <Card className="mb-6 border-dashed">
                <CardContent className="p-7 text-center">
                  <Package className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium">
                    Ainda não encontramos produtos nessa categoria.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Você pode ver todos os produtos ou falar com a Matilha Prado pelo WhatsApp.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => selectBrand('todas')}>
                      Ver todos
                    </Button>
                    <Button asChild size="sm">
                      <a href={whatsapp} target="_blank" rel="noreferrer">
                        Falar no WhatsApp
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="stagger-grid grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((product) => {
                  const currentPrice = product.precoPromo ?? product.preco
                  const hasPromo = product.precoPromo != null && product.precoPromo < product.preco

                  return (
                    <Card key={product.id} className="boutique-product group overflow-hidden border-border/70 bg-card py-0 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                      <CardContent className="flex h-full flex-col p-4 sm:p-5">
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(product)}
                          className="text-left"
                          aria-label={`Ver detalhes de ${product.nome}`}
                        >
                          <div className="relative mb-4 aspect-square overflow-hidden rounded-2xl border border-border/50 bg-white">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.nome}
                                loading="lazy"
                                className="h-full w-full object-contain p-3 transition-transform duration-500 motion-safe:group-hover:scale-[1.04] sm:p-4"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <Package className="size-10 text-muted-foreground/35" />
                              </div>
                            )}

                            {hasPromo && (
                              <Badge className="absolute left-2 top-2 bg-orange-500 text-white hover:bg-orange-500">
                                <Sparkles className="size-3" />
                                Oferta
                              </Badge>
                            )}
                          </div>

                          <p className="line-clamp-2 min-h-12 text-base font-semibold leading-snug tracking-tight group-hover:text-primary">
                            {product.nome}
                          </p>
                          <p className="mt-1.5 truncate text-xs text-muted-foreground">
                            {product.categoria}
                          </p>
                          {(isClothingProduct(product) || (product.variantes && product.variantes.length > 1)) && (
                            <Badge variant="outline" className="mt-2 border-primary/25 bg-primary/5 text-primary">
                              {isClothingProduct(product)
                                ? 'Tamanhos: P · M · G · GG'
                                : product.variantes?.some((variant) => Boolean(variant.modeloLabel))
                                  ? 'Escolha o modelo'
                                  : product.variantes?.some((variant) => Boolean(variant.corLabel))
                                    ? 'Escolha a cor'
                                    : (product.variantes?.length || 0) + ' variações disponíveis'}
                            </Badge>
                          )}
                        </button>

                        <div className="mt-auto pt-4">
                          {hasPromo && (
                            <p className="text-[11px] text-muted-foreground line-through">
                              {money(product.preco)}
                            </p>
                          )}
                          <p className="text-xl font-extrabold tracking-tight text-primary">{money(currentPrice)}</p>
                          <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
      product.estoqueIlimitado || product.estoque > 0
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-slate-100 text-slate-500'
    }`}>
                            {product.estoqueIlimitado
                              ? 'Disponível sem limite de estoque'
                              : product.estoque > 0
                                ? 'Disponível'
                                : 'Indisponível'}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          onClick={onBuy}
                          className="mt-4 h-11 w-full text-sm font-semibold shadow-sm"
                        >
                          {!product.estoqueIlimitado && product.estoque <= 0
                            ? 'Entrar e avisar quando chegar'
                            : 'Comprar'}
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={onBuy} className="btn-brand">
                Entrar para ver a loja completa
                <ArrowRight className="size-4" />
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={whatsapp} target="_blank" rel="noreferrer">
                  Pedir uma recomendação
                </a>
              </Button>
            </div>
          </>
        )}
      </div>

      <ProductDetailsDialog
        product={selectedProduct}
        open={Boolean(selectedProduct)}
        onOpenChange={(open) => {
          if (!open) setSelectedProduct(null)
        }}
        onLoginToBuy={onBuy}
      />
    </section>
  )
}
