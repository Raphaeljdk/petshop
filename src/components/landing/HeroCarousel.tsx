'use client'

import { useEffect, useState, type ReactNode } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function HeroCarousel({ children, onShop, onAccount }: {
  children: ReactNode
  onShop: () => void
  onAccount: () => void
}) {
  const [viewport, carousel] = useEmblaCarousel({ loop: true })
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!carousel) return
    const update = () => setSelected(carousel.selectedScrollSnap())
    update()
    carousel.on('select', update)
    carousel.on('reInit', update)
    return () => { carousel.off('select', update); carousel.off('reInit', update) }
  }, [carousel])

  return (
    <div role="region" aria-roledescription="carrossel" aria-label="Destaques da Matilha Prado" className="bg-slate-950 text-white">
      <div ref={viewport} className="overflow-hidden">
        <div className="flex touch-pan-y">
          <div className="min-w-0 flex-[0_0_100%]" role="group" aria-roledescription="slide" aria-label="1 de 2" inert={selected !== 0}>{children}</div>
          <div className="min-w-0 flex-[0_0_100%] flex items-center bg-navy-gradient px-6 py-12 sm:px-10" role="group" aria-roledescription="slide" aria-label="2 de 2" inert={selected !== 1}>
            <div className="container mx-auto max-w-5xl">
              <ShoppingBag className="size-12 text-orange-300 mb-6" aria-hidden="true" />
              <p className="text-sm uppercase tracking-widest text-cyan-200 mb-4">A loja da sua matilha</p>
              <h2 className="text-3xl sm:text-5xl font-bold max-w-2xl">Os favoritos do seu pet estão logo aqui.</h2>
              <p className="mt-5 max-w-xl text-white/80 text-lg">Brinquedos, petiscos e cuidados para o dia a dia. Explore os produtos e encontre o que combina com seu melhor amigo.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button size="lg" onClick={onShop} className="bg-orange-300 text-slate-950 hover:bg-orange-200">Explorar a loja</Button>
                <Button size="lg" variant="outline" onClick={onAccount} className="bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white">Minha conta</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-center items-center gap-4 py-3" aria-label="Controles dos destaques">
        <Button variant="ghost" size="icon" aria-label="Destaque anterior" onClick={() => carousel?.scrollPrev()}><ChevronLeft /></Button>
        {[0, 1].map(index => <button key={index} type="button" aria-label={`Ir para destaque ${index + 1}`} aria-current={selected === index ? 'true' : undefined} onClick={() => carousel?.scrollTo(index)} className="p-3"><span className={`block h-2 rounded-full ${selected === index ? 'w-7 bg-orange-300' : 'w-2 bg-white/40'}`} /></button>)}
        <Button variant="ghost" size="icon" aria-label="Próximo destaque" onClick={() => carousel?.scrollNext()}><ChevronRight /></Button>
      </div>
    </div>
  )
}
