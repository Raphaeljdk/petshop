'use client'

import { MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

type StoreHeroProps = {
  whatsappUrl: string
  productsCount: number
  categoriesCount: number
}

export function StoreHero({
  whatsappUrl,
  productsCount,
  categoriesCount,
}: StoreHeroProps) {
  return (
    <section className="store-hero overflow-hidden rounded-[1.75rem] border px-5 py-6 sm:px-7 sm:py-8">
      <div className="grid items-center gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
            <Sparkles className="size-3.5 text-orange-300" />
            Boutique Matilha Prado
          </div>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-[-0.04em] text-white sm:text-4xl">
            Tudo para deixar a rotina do seu pet ainda melhor.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
            Produtos selecionados, catálogo integrado e atendimento da equipe
            quando você precisar de ajuda antes de finalizar.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="h-11 bg-white text-slate-900 hover:bg-white/90">
              <a href="#catalogo-loja">Explorar produtos</a>
            </Button>
            <Button asChild variant="outline" className="h-11 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" />
                Falar com a loja
              </a>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="store-hero-stat">
            <span className="text-2xl font-bold tabular-nums text-white">{productsCount}</span>
            <span className="text-xs text-white/60">produtos disponíveis</span>
          </div>
          <div className="store-hero-stat">
            <span className="text-2xl font-bold tabular-nums text-white">{categoriesCount}</span>
            <span className="text-xs text-white/60">categorias</span>
          </div>
          <div className="store-hero-stat col-span-2 flex-row items-center gap-3 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <ShieldCheck className="size-5" />
            </span>
            <span>
              <strong className="block text-sm text-white">Compra assistida</strong>
              <span className="text-xs text-white/60">
                Atendimento direto da Matilha Prado quando necessário
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
