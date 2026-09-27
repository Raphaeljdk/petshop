'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

const slides = [...new Set((process.env.NEXT_PUBLIC_STORE_CAROUSEL_IMAGES || '').split(',').map(value => value.trim()).filter(Boolean))]
const configuredInterval = Number(process.env.NEXT_PUBLIC_STORE_CAROUSEL_AUTOPLAY_MS ?? 6500)
// Zero disables autoplay; invalid values use the documented default.
const autoplayMs = configuredInterval === 0 ? 0 : Number.isFinite(configuredInterval) ? Math.max(3500, configuredInterval) : 6500

export function StorePromoCarousel() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [environment, setEnvironment] = useState({ reducedMotion: true, visible: true })
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const canRotate = slides.length > 1 && autoplayMs > 0 && !environment.reducedMotion
  const rotating = canRotate && !paused && !hovered && !focused && environment.visible

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setEnvironment({ reducedMotion: media.matches, visible: document.visibilityState === 'visible' })
    const frame = window.requestAnimationFrame(sync)
    media.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.cancelAnimationFrame(frame)
      media.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  useEffect(() => {
    if (!rotating) return
    const timer = window.setTimeout(() => setActive(value => (value + 1) % slides.length), autoplayMs)
    return () => window.clearTimeout(timer)
  }, [rotating, active])

  if (slides.length === 0) return null
  const move = (direction: number) => setActive(value => (value + direction + slides.length) % slides.length)

  return (
    <section
      className="store-promo-carousel"
      aria-label="Destaques da Matilha Prado"
      aria-roledescription="carrossel"
      tabIndex={slides.length > 1 ? 0 : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1) }
      }}
      onTouchStart={event => {
        const touch = event.touches.length === 1 ? event.touches[0] : null
        touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
      }}
      onTouchCancel={() => { touchStart.current = null }}
      onTouchEnd={event => {
        const start = touchStart.current
        const end = event.changedTouches[0]
        touchStart.current = null
        if (!start || !end) return
        const delta = end.clientX - start.x
        if (Math.abs(delta) >= 45 && Math.abs(delta) > Math.abs(end.clientY - start.y)) move(delta > 0 ? -1 : 1)
      }}
    >
      {slides.map((src, index) => (
        <div key={src} className="store-promo-slide" data-active={index === active} aria-hidden={index !== active}>
          <Image src={src} alt={'Destaque promocional ' + (index + 1) + ' da Matilha Prado'} fill unoptimized sizes="(max-width: 767px) 100vw, 1200px" className="object-cover" loading={index === 0 ? 'eager' : 'lazy'} />
        </div>
      ))}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-5 pb-20 pt-10 text-white sm:px-7">
        <p className="mb-2 text-sm font-medium text-white/90">Destaques da loja</p>
        <h2 className="max-w-xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">Novidades para a sua matilha.</h2>
      </div>

      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 bg-slate-950/35 p-3 text-white sm:px-5">
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="ghost" className="size-11 rounded-full text-white hover:bg-white/20 hover:text-white" onClick={() => move(-1)} aria-label="Destaque anterior"><ChevronLeft className="size-5" /></Button>
            <span className="min-w-10 text-center text-sm tabular-nums" aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">{active + 1} / {slides.length}</span>
            <Button type="button" size="icon" variant="ghost" className="size-11 rounded-full text-white hover:bg-white/20 hover:text-white" onClick={() => move(1)} aria-label="Próximo destaque"><ChevronRight className="size-5" /></Button>
          </div>
          {canRotate && <Button type="button" variant="ghost" className="h-11 rounded-full text-white hover:bg-white/20 hover:text-white" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Retomar carrossel automático' : 'Pausar carrossel automático'}>{paused ? <Play className="size-4" /> : <Pause className="size-4" />}<span>{paused ? 'Retomar' : 'Pausar'}</span></Button>}
        </div>
      )}
    </section>
  )
}
