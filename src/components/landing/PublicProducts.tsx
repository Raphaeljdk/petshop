'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, Bath, Bone, Cat, Check, Dumbbell, Grid2X2, Loader2, Package, PawPrint, ShoppingBag, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'
import {
  ProductDetailsDialog,
  type ProductPreview,
} from '@/components/products/ProductDetailsDialog'

type PublicProduct = ProductPreview

type ProductShortcut = {
  id: string
  label: string
  emoji: string
  keywords: string[]
  accent: string
  icon: typeof Cat
}

const PRODUCT_SHORTCUTS: ProductShortcut[] = [
  {
    id: 'banhos-cuidados',
    label: 'Banhos e cuidados',
    emoji: '🧴',
    keywords: ['banho', 'higiene', 'shampoo', 'condicionador', 'perfume', 'hydra', 'pet society', 'escova'],
    accent: 'bg-pink-100',
    icon: Bath,
  },
  {
    id: 'gatos',
    label: 'Para gatos',
    emoji: '🐱',
    keywords: ['gato', 'gatos', 'felino', 'felinos', 'cat'],
    accent: 'bg-emerald-100',
    icon: Cat,
  },
  {
    id: 'acessorios',
    label: 'Acessórios',
    emoji: '🦮',
    keywords: ['acessorio', 'acessorios', 'coleira', 'guia', 'peitoral', 'roupa', 'cama', 'comedouro', 'bebedouro'],
    accent: 'bg-lime-100',
    icon: PawPrint,
  },
  {
    id: 'treino',
    label: 'Para treino',
    emoji: '🎾',
    keywords: ['treino', 'treinamento', 'adestramento', 'recompensa', 'clicker', 'training'],
    accent: 'bg-orange-100',
    icon: Dumbbell,
  },
  {
    id: 'mordedores',
    label: 'Mordedores',
    emoji: '🦴',
    keywords: ['mordedor', 'mordedores', 'brinquedo', 'brinquedos', 'kong', 'bola', 'osso'],
    accent: 'bg-rose-100',
    icon: Bone,
  },
]

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function matchesShortcut(product: PublicProduct, shortcut: ProductShortcut) {
  const haystack = normalizeText(
    [product.nome, product.descricao || '', product.categoria || ''].join(' ')
  )

  return shortcut.keywords.some((keyword) => haystack.includes(normalizeText(keyword)))
}

export function PublicProducts({ onBuy }: { onBuy: () => void }) {
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('todas')
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const resultsRef = useRef<HTMLHeadingElement>(null)

  function selectCategory(nextCategory: string) {
    setCategory(nextCategory)
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

  const selectedShortcut = useMemo(
    () => PRODUCT_SHORTCUTS.find((shortcut) => shortcut.id === category) || null,
    [category]
  )

  const visible = useMemo(() => {
    const filtered = selectedShortcut
      ? products.filter((product) => matchesShortcut(product, selectedShortcut))
      : products

    return [...filtered]
      .sort((a, b) => {
        const aSemEstoque = !a.estoqueIlimitado && a.estoque <= 0
        const bSemEstoque = !b.estoqueIlimitado && b.estoque <= 0
        return aSemEstoque === bSemEstoque ? 0 : aSemEstoque ? 1 : -1
      })
      .slice(0, 12)
  }, [products, selectedShortcut])

  const shortcutImages = useMemo(() => {
    const map = new Map<string, string>()

    for (const shortcut of PRODUCT_SHORTCUTS) {
      const product = products.find(
        (item) => item.imageUrl && matchesShortcut(item, shortcut)
      )
      if (product?.imageUrl) map.set(shortcut.id, product.imageUrl)
    }

    return map
  }, [products])

  const money = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const whatsapp = matilhaWhatsAppUrl(
    'Olá! Vi os produtos no site da Matilha Prado e gostaria de ajuda para escolher um produto para o meu pet.'
  )

  return (
    <section ref={sectionRef} id="produtos" className="boutique-section py-14 sm:py-18 lg:py-24" aria-labelledby="boutique-title">
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
            Escolha uma categoria e explore a vitrine.
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
            <div className="boutique-categories mb-8" role="group" aria-label="Filtrar vitrine por categoria">
                <button type="button" className="boutique-category boutique-category-all" aria-pressed={category === 'todas'} aria-controls="boutique-results" onClick={() => selectCategory('todas')} style={{ '--category-order': 0 } as CSSProperties}>
                  <span className="boutique-category-art"><Grid2X2 className="size-9 sm:size-11" aria-hidden="true" /></span>
                  <span className="boutique-category-name">Toda a boutique</span>
                  <span className="boutique-category-hint">Explore a coleção <ArrowRight className="size-3.5" aria-hidden="true" /></span>
                  {category === 'todas' && <Check className="boutique-category-check size-5" aria-hidden="true" />}
                </button>
                {PRODUCT_SHORTCUTS.map((shortcut, index) => {
                  const imageUrl = shortcutImages.get(shortcut.id)
                  const selected = category === shortcut.id
                  const Icon = shortcut.icon

                  return (
                    <button
                      key={shortcut.id}
                      type="button"
                      aria-pressed={selected}
                      aria-controls="boutique-results"
                      onClick={() => selectCategory(shortcut.id)}
                      className="group boutique-category"
                      style={{ '--category-order': index + 1 } as CSSProperties}
                    >
                      <span
                        className={[
                          'boutique-category-art',
                          shortcut.accent,
                        ].join(' ')}
                      >
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <Icon className="size-9 sm:size-11" strokeWidth={1.5} aria-hidden="true" />
                        )}
                      </span>
                      <span className="boutique-category-name">
                        {shortcut.label}
                      </span>
                      <span className="boutique-category-hint">Ver produtos <ArrowRight className="size-3.5" aria-hidden="true" /></span>
                      {selected && <Check className="boutique-category-check size-5" aria-hidden="true" />}
                    </button>
                  )
                })}
            </div>

            <div className="mb-6 flex items-center justify-between gap-3">
              <div role="status" aria-live="polite">
                <h3 ref={resultsRef} id="boutique-results" tabIndex={-1} className="scroll-mt-28 rounded-sm text-sm font-semibold">
                  {selectedShortcut ? selectedShortcut.label : 'Todos os produtos'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedShortcut
                    ? 'Mostrando itens relacionados à categoria selecionada.'
                    : 'Selecione uma categoria acima para filtrar.'}
                </p>
              </div>
              {selectedShortcut && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => selectCategory('todas')}
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
                    <Button size="sm" variant="outline" onClick={() => selectCategory('todas')}>
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
              <div className="stagger-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
                {visible.map((product) => {
                  const currentPrice = product.precoPromo ?? product.preco
                  const hasPromo = product.precoPromo != null && product.precoPromo < product.preco

                  return (
                    <Card key={product.id} className="boutique-product group overflow-hidden py-0 card-hover">
                      <CardContent className="flex h-full flex-col p-3 sm:p-4">
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(product)}
                          className="text-left"
                          aria-label={`Ver detalhes de ${product.nome}`}
                        >
                          <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-muted">
                            {product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={product.imageUrl}
                                alt={product.nome}
                                loading="lazy"
                                className="h-full w-full object-contain p-3 transition-transform duration-500 motion-safe:group-hover:scale-105"
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

                          <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug group-hover:text-primary">
                            {product.nome}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">
                            {product.categoria}
                          </p>
                        </button>

                        <div className="mt-auto pt-3">
                          {hasPromo && (
                            <p className="text-[11px] text-muted-foreground line-through">
                              {money(product.preco)}
                            </p>
                          )}
                          <p className="text-base font-bold text-primary">{money(currentPrice)}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
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
                          className="mt-3 h-9 w-full"
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
