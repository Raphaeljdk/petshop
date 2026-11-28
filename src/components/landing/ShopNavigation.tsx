'use client'
import { useState } from 'react'
import {
  Armchair,
  Cat,
  ChevronRight,
  Dog,
  Grid2X2,
  Package,
  PawPrint,
  Scissors,
  Sparkles,
  Store,
} from 'lucide-react'
import { findKongClassicImage, MARCA_PERSONALIZAVEIS, SEM_MARCA } from '@/lib/product-brands'
import type { ShopGroup, ShopProduct } from '@/lib/storefront-catalog'
export function CategoryNav({
  groups,
  offers,
  onSelect,
  onServices,
  onOffers,
}: {
  groups: ShopGroup[]
  offers: boolean
  onSelect: (id: string) => void
  onServices: () => void
  onOffers: () => void
}) {
  const [all, setAll] = useState(false)
  const top = all ? groups : groups.slice(0, 5)
  return (
    <section className="mp-section" id="categorias" aria-labelledby="category-title">
      <div className="mp-heading">
        <PawPrint className="mp-heading-icon" />
        <div>
          <h2 id="category-title">Explore por categoria</h2>
          <p>Encontre o que o seu pet precisa.</p>
        </div>
        {groups.length > 5 && (
          <button className="mp-text-link" aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? 'Ver menos' : 'Ver todas as categorias'}
            <ChevronRight />
          </button>
        )}
      </div>
      <div className="mp-tiles">
        {top.map((g) => (
          <button className="mp-tile" key={g.id} onClick={() => onSelect(g.id)}>
            {g.art ? (
              <img
                alt=""
                width="90"
                height="70"
                src={'/images/vitrine/' + g.art + '.webp'}
                loading="lazy"
              />
            ) : g.id === 'cachorros' ? (
              <Dog />
            ) : g.id === 'gatos' ? (
              <Cat />
            ) : g.id === 'personalizaveis' ? (
              <Sparkles />
            ) : (
              <Grid2X2 />
            )}
            <span>{g.label}</span>
          </button>
        ))}
        {offers && (
          <button className="mp-tile" onClick={onOffers}>
            <img src="/images/vitrine/ofertas.webp" alt="" width="90" height="70" loading="lazy" />
            <span>Ofertas especiais</span>
          </button>
        )}
        {(all || top.length < 5 || !offers) && (
          <button className="mp-tile" onClick={onServices}>
            <Scissors />
            <span>Banho e tosa</span>
          </button>
        )}
      </div>
    </section>
  )
}
export function BrandNav({
  products,
  onSelect,
}: {
  products: ShopProduct[]
  onSelect: (b: string) => void
}) {
  const [all, setAll] = useState(false)
  const brands = new Map<string, string | null>()
  for (const product of products) {
    const name = product.marca
    if (name && name !== SEM_MARCA && (!brands.has(name) || !brands.get(name)))
      brands.set(name, product.imageUrl)
  }
  if (brands.has('Kong')) brands.set('Kong', findKongClassicImage(products))
  const list = [...brands.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const show = all ? list : list.slice(0, 5)
  return (
    <section id="marcas" className="mp-section" aria-labelledby="brands-title">
      <div className="mp-heading">
        <Store className="mp-heading-icon" />
        <div>
          <h2 id="brands-title">Nossas marcas</h2>
          <p>Marcas que você encontra na boutique.</p>
        </div>
        {list.length > 5 && (
          <button className="mp-text-link" aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? 'Ver menos' : 'Ver todas'}
            <ChevronRight />
          </button>
        )}
      </div>
      <div className="mp-brands">
        {show.map((b) => (
          <button key={b} className="mp-brand" onClick={() => onSelect(b)}>
            {brands.get(b) ? (
              <img
                src={brands.get(b)!}
                alt=""
                loading="lazy"
                width="46"
                height="46"
                onError={(e) => {
                  e.currentTarget.hidden = true
                }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <Package />
            )}
            <strong>{b}</strong>
          </button>
        ))}
        {!brands.has(MARCA_PERSONALIZAVEIS) && (
          <span className="mp-brand mp-coming">
            <Armchair />
            <strong>Matilha Prado Personalizáveis</strong>
            <small>Em breve</small>
          </span>
        )}
      </div>
    </section>
  )
}
