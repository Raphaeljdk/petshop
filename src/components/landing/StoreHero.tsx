'use client'
import { useRef, useState, type PointerEvent } from 'react'
import {
  CalendarDays,
  ChevronRight,
  CreditCard,
  HeartHandshake,
  Pause,
  PawPrint,
  Play,
  ShoppingBag,
  Truck,
} from 'lucide-react'
import { useStoreMotion } from './StoreMotion'
import type { Shelf } from '@/lib/storefront-catalog'
const art = '/images/vitrine/'
const props = [
  { image: 'osso', label: 'Ver petiscos', category: 'petiscos' },
  { image: 'frasco', label: 'Ver higiene e beleza', category: 'higiene' },
  { image: 'tigela', label: 'Ver alimentação', category: 'alimentacao' },
  { image: 'corda', label: 'Ver brinquedos', category: 'brinquedos' },
]
const slides = [
  {
    label: 'Bem-vindo à Matilha',
    title: 'Cuidado completo para o seu pet,',
    accent: 'em um só lugar!',
    description: 'Produtos, banho e tosa e muito carinho para quem faz parte da sua família.',
    action: 'Comprar produtos',
    shelf: 'catalogo',
  },
  {
    label: 'Boutique Matilha Prado',
    title: 'Descobertas para o',
    accent: 'dia a dia do pet.',
    description: 'Conheça os itens que chegaram à boutique nos últimos 30 dias.',
    action: 'Ver novidades',
    shelf: 'novidades',
  },
  {
    label: 'Spa da Matilha',
    title: 'Hora de relaxar,',
    accent: 'do banho às patas.',
    description: 'Conheça os cuidados da equipe e consulte o melhor horário para seu pet.',
    action: 'Conhecer serviços',
    shelf: 'catalogo',
  },
] as const
export function StoreHero({
  paused,
  onPause,
  onShop,
  onBook,
  onSpa,
  categories,
}: {
  paused: boolean
  onPause: () => void
  onShop: (s: Shelf, c?: string) => void
  onBook: () => void
  onSpa: () => void
  categories: Set<string>
}) {
  const frame = useStoreMotion<HTMLElement>(paused)
  const [slide, setSlide] = useState(0)
  const [reaction, setReaction] = useState<string | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const current = slides[slide]
  function follow(e: PointerEvent<HTMLElement>) {
    const node = stage.current
    if (!node || frame.current?.dataset.motion !== 'true' || e.pointerType !== 'mouse') return
    const box = e.currentTarget.getBoundingClientRect()
    node.style.setProperty('--look-x', ((e.clientX - box.left) / box.width - 0.5) * 12 + 'px')
    node.style.setProperty('--look-y', ((e.clientY - box.top) / box.height - 0.5) * 7 + 'px')
  }
  function reset() {
    stage.current?.style.removeProperty('--look-x')
    stage.current?.style.removeProperty('--look-y')
    setReaction(null)
  }
  return (
    <section
      ref={frame}
      id="inicio"
      className="mp-hero"
      aria-label="Destaques da Matilha Prado"
      onPointerMove={follow}
      onPointerLeave={reset}
    >
      <div className="mp-wrap mp-hero-grid">
        <div className="mp-hero-copy">
          <div className="mp-label">
            <PawPrint fill="currentColor" />
            {current.label}
          </div>
          <h1>
            {current.title} <em>{current.accent}</em>
          </h1>
          <p>{current.description}</p>
          <div className="mp-actions">
            <button
              className="mp-btn mp-orange"
              onClick={() => (slide === 2 ? onSpa() : onShop(current.shelf))}
            >
              <ShoppingBag />
              {current.action}
            </button>
            <button className="mp-btn mp-outline" onClick={onBook}>
              <CalendarDays />
              Agendar banho e tosa
            </button>
          </div>
          <div className="mp-hero-trust">
            <span>
              <Truck />
              Entrega por CEP
            </span>
            <span>
              <HeartHandshake />
              Cuidado em família
            </span>
            <span>
              <CreditCard />
              Mercado Pago
            </span>
          </div>
        </div>
        <div className="mp-stage" ref={stage} data-reaction={reaction || ''}>
          <div className="mp-orbit" aria-hidden="true" />
          <div className="mp-plinth" aria-hidden="true" />
          <div className="mp-husky-look">
            <div className="mp-husky-welcome">
              <div className="mp-husky">
                <img
                  src={art + 'husky-400.webp'}
                  srcSet={art + 'husky-400.webp 400w, ' + art + 'husky-760.webp 760w'}
                  sizes="(max-width:600px) 300px, 480px"
                  width="760"
                  height="760"
                  alt="Mascote husky da Matilha Prado, de olhos azuis e bandana preta com a pata laranja"
                  fetchPriority="high"
                />
                <i className="mp-ear left" aria-hidden="true" />
                <i className="mp-ear right" aria-hidden="true" />
                <i className="mp-lid left" aria-hidden="true" />
                <i className="mp-lid right" aria-hidden="true" />
              </div>
            </div>
          </div>
          {props.map((p) =>
            categories.has(p.category) ? (
              <button
                type="button"
                key={p.image}
                className={'mp-prop ' + p.image}
                aria-label={p.label}
                onFocus={() => setReaction(p.image)}
                onBlur={reset}
                onPointerEnter={() => setReaction(p.image)}
                onPointerLeave={() => setReaction(null)}
                onClick={() => onShop('catalogo', p.category)}
              >
                <img src={art + p.image + '.webp'} alt="" width="160" height="160" />
              </button>
            ) : (
              <span
                key={p.image}
                className={'mp-prop ' + p.image}
                onPointerEnter={() => setReaction(p.image)}
                onPointerLeave={() => setReaction(null)}
                aria-hidden="true"
              >
                <img src={art + p.image + '.webp'} alt="" width="160" height="160" />
              </span>
            ),
          )}
        </div>
        <div className="mp-slide-nav" aria-label="Escolher destaque">
          {slides.map((s, i) => (
            <button
              type="button"
              key={s.label}
              onClick={() => setSlide(i)}
              aria-label={s.label}
              aria-current={slide === i ? 'true' : undefined}
            >
              <i />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mp-motion-control"
          onClick={onPause}
          aria-label={paused ? 'Ativar animações' : 'Pausar animações'}
          aria-pressed={paused}
        >
          {paused ? <Play /> : <Pause />}
        </button>
        {slide > 0 && (
          <div className="mp-prints" key={slide} aria-hidden="true">
            <PawPrint />
            <PawPrint />
            <PawPrint />
          </div>
        )}
      </div>
    </section>
  )
}
export function SpaBanner({ paused, onOpen }: { paused: boolean; onOpen: () => void }) {
  const ref = useStoreMotion<HTMLElement>(paused)
  return (
    <section ref={ref} className="mp-spa-banner" aria-label="Spa pet e banho">
      <img
        className="mp-spa-photo"
        alt="Ilustração do husky da Matilha em um banho de espuma"
        src={art + 'banho-520.webp'}
        srcSet={art + 'banho-520.webp 520w, ' + art + 'banho-900.webp 900w'}
        sizes="(max-width:600px) 60vw, 610px"
        loading="lazy"
        width="900"
        height="600"
      />
      <div className="mp-bubbles" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <b />
        <b />
      </div>
      <div className="mp-spa-copy">
        <span className="mp-label">
          <PawPrint />
          Banho e tosa
        </span>
        <h2>
          Seu pet merece <em>esse carinho.</em>
        </h2>
        <p>Banho com produtos Hydra e cuidados para cada pelagem.</p>
        <button className="mp-btn mp-white" onClick={onOpen}>
          Conhecer serviços <ChevronRight />
        </button>
      </div>
    </section>
  )
}
