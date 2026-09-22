'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Loader2, Package, ShoppingBag, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { matilhaWhatsAppUrl } from '@/lib/matilha-contact'

type PublicProduct = {
  id: string
  nome: string
  descricao: string | null
  categoria: string
  preco: number
  precoPromo: number | null
  estoque: number
  imageUrl: string | null
}

export function PublicProducts({ onBuy }: { onBuy: () => void }) {
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('todas')

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

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.categoria).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    ),
    [products]
  )

  const visible = useMemo(() => {
    const filtered =
      category === 'todas' ? products : products.filter((product) => product.categoria === category)

    return filtered.slice(0, 12)
  }, [category, products])

  const money = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const whatsapp = matilhaWhatsAppUrl(
    'Olá! Vi os produtos no site da Matilha Prado e gostaria de ajuda para escolher um produto para o meu pet.'
  )

  return (
    <section id="produtos" className="py-14 sm:py-18 lg:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
          <Badge variant="secondary" className="mb-3">
            <ShoppingBag className="size-3.5" />
            Boutique Matilha Prado
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Veja alguns produtos antes mesmo de entrar
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Preços, promoções e disponibilidade vindos do catálogo da Matilha Prado.
            Você só precisa entrar na sua conta quando quiser comprar.
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
            {categories.length > 1 && (
              <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
                <Button
                  type="button"
                  size="sm"
                  variant={category === 'todas' ? 'default' : 'outline'}
                  onClick={() => setCategory('todas')}
                  className="shrink-0"
                >
                  Todos
                </Button>
                {categories.slice(0, 10).map((item) => (
                  <Button
                    key={item}
                    type="button"
                    size="sm"
                    variant={category === item ? 'default' : 'outline'}
                    onClick={() => setCategory(item)}
                    className="shrink-0"
                  >
                    {item}
                  </Button>
                ))}
              </div>
            )}

            <div className="stagger-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
              {visible.map((product) => {
                const currentPrice = product.precoPromo ?? product.preco
                const hasPromo = product.precoPromo != null && product.precoPromo < product.preco

                return (
                  <Card key={product.id} className="group overflow-hidden py-0 card-hover">
                    <CardContent className="flex h-full flex-col p-3 sm:p-4">
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

                      <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug">
                        {product.nome}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">{product.categoria}</p>

                      <div className="mt-auto pt-3">
                        {hasPromo && (
                          <p className="text-[11px] text-muted-foreground line-through">{money(product.preco)}</p>
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
    </section>
  )
}
