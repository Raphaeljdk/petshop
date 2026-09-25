'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Loader2, Package, ShoppingBag, Sparkles } from 'lucide-react'
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
}

const PRODUCT_SHORTCUTS: ProductShortcut[] = [
  {
    id: 'banhos-cuidados',
    label: 'Banhos e cuidados',
    emoji: '🧴',
    keywords: ['banho', 'higiene', 'shampoo', 'condicionador', 'perfume', 'hydra', 'pet society', 'escova'],
    accent: 'bg-pink-100',
  },
  {
    id: 'gatos',
    label: 'Para gatos',
    emoji: '🐱',
    keywords: ['gato', 'gatos', 'felino', 'felinos', 'cat'],
    accent: 'bg-emerald-100',
  },
  {
    id: 'acessorios',
    label: 'Acessórios',
    emoji: '🦮',
    keywords: ['acessorio', 'acessorios', 'coleira', 'guia', 'peitoral', 'roupa', 'cama', 'comedouro', 'bebedouro'],
    accent: 'bg-lime-100',
  },
  {
    id: 'treino',
    label: 'Para treino',
    emoji: '🎾',
    keywords: ['treino', 'treinamento', 'adestramento', 'recompensa', 'clicker', 'training'],
    accent: 'bg-orange-100',
  },
  {
    id: 'mordedores',
    label: 'Mordedores',
    emoji: '🦴',
    keywords: ['mordedor', 'mordedores', 'brinquedo', 'brinquedos', 'kong', 'bola', 'osso'],
    accent: 'bg-rose-100',
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

    return filtered.slice(0, 12)
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
    <section id="produtos" className="bg-background py-14 sm:py-18 lg:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
          <Badge variant="secondary" className="mb-3">
            <ShoppingBag className="size-3.5" />
            Boutique Matilha Prado
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Encontre o que seu pet precisa
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Escolha uma categoria para filtrar a vitrine. Preços, promoções e disponibilidade
            vêm do catálogo da Matilha Prado.
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
            <div className="mb-8 overflow-x-auto pb-2">
              <div className="mx-auto flex min-w-max justify-center gap-3 sm:gap-5 lg:gap-7">
                {PRODUCT_SHORTCUTS.map((shortcut) => {
                  const imageUrl = shortcutImages.get(shortcut.id)
                  const selected = category === shortcut.id

                  return (
                    <button
                      key={shortcut.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setCategory(selected ? 'todas' : shortcut.id)}
                      className="group w-32 shrink-0 text-center sm:w-36"
                    >
                      <span
                        className={[
                          'mx-auto flex aspect-square w-24 items-center justify-center overflow-hidden rounded-[32%] border transition-all duration-300 sm:w-28',
                          shortcut.accent,
                          selected
                            ? 'border-primary ring-2 ring-primary/25 shadow-lg -translate-y-1'
                            : 'border-transparent group-hover:-translate-y-1 group-hover:shadow-md',
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
                          <span className="text-5xl" aria-hidden="true">{shortcut.emoji}</span>
                        )}
                      </span>
                      <span
                        className={[
                          'mt-3 block text-xs font-semibold uppercase tracking-wide transition-colors sm:text-sm',
                          selected ? 'text-primary' : 'text-foreground group-hover:text-primary',
                        ].join(' ')}
                      >
                        {shortcut.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  {selectedShortcut ? selectedShortcut.label : 'Todos os produtos'}
                </p>
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
                  onClick={() => setCategory('todas')}
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
                    <Button size="sm" variant="outline" onClick={() => setCategory('todas')}>
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
                    <Card key={product.id} className="group overflow-hidden py-0 card-hover">
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
                                className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
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
                            {product.estoque > 0 ? 'Disponível' : 'Indisponível'}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          onClick={onBuy}
                          disabled={product.estoque <= 0}
                          className="mt-3 h-9 w-full"
                        >
                          Comprar
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
