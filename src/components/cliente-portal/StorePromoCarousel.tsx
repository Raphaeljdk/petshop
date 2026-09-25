'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Images } from 'lucide-react'
import { Button } from '@/components/ui/button'

const rawImages = process.env.NEXT_PUBLIC_STORE_CAROUSEL_IMAGES || ''
const autoplayMs = Math.max(
  3500,
  Number(process.env.NEXT_PUBLIC_STORE_CAROUSEL_AUTOPLAY_MS || 6500) || 6500
)

export function StorePromoCarousel() {
  const slides = useMemo(
    () =>
      rawImages
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    []
  )
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = window.setInterval(() => {
      setActive((value) => (value + 1) % slides.length)
    }, autoplayMs)
    return () => window.clearInterval(timer)
  }, [slides.length])

  if (slides.length === 0) return null

  const move = (direction: number) => {
    setActive((value) => (value + direction + slides.length) % slides.length)
  }

  return (
    <section className="store-promo-carousel" aria-label="Destaques da Matilha Prado">
      {slides.map((image, index) => (
        <div key={image} className="store-promo-slide" data-active={index === active} aria-hidden={index !== active}>
          <img src={image} alt="" className="size-full object-cover" loading={index === 0 ? 'eager' : 'lazy'} />
        </div>
      ))}

      <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-7">
        <div className="max-w-xl">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
            <Images className="size-4" />
            Destaques da loja
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Novidades escolhidas para a sua matilha.
          </h2>
          <p className="mt-2 text-sm text-white/75">
            O carrossel já está preparado para receber as fotos promocionais da loja.
          </p>
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <Button type="button" size="icon" variant="secondary" className="absolute left-3 top-1/2 z-20 size-10 -translate-y-1/2 rounded-full bg-white/90" onClick={() => move(-1)} aria-label="Foto anterior">
            <ChevronLeft className="size-5" />
          </Button>
          <Button type="button" size="icon" variant="secondary" className="absolute right-3 top-1/2 z-20 size-10 -translate-y-1/2 rounded-full bg-white/90" onClick={() => move(1)} aria-label="Próxima foto">
            <ChevronRight className="size-5" />
          </Button>
          <div className="absolute bottom-4 right-4 z-20 flex gap-1.5">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActive(index)}
                className={`h-2 rounded-full transition-all ${index === active ? 'w-6 bg-white' : 'w-2 bg-white/45'}`}
                aria-label={`Ir para foto ${index + 1}`}
                aria-current={index === active ? 'true' : undefined}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
