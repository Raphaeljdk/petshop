'use client'

import { useMemo, useRef, useState } from 'react'
import { ChevronRight, Heart, Package, Search, ShoppingBag, SlidersHorizontal, Tag } from 'lucide-react'
import { SEM_MARCA } from '@/lib/product-brands'
import {
  hasOffer,
  makeSearchIndex,
  money,
  onShelf,
  price,
  searchCatalog,
  type Shelf,
  type ShopGroup,
  type ShopProduct,
  type ShopSort,
} from '@/lib/storefront-catalog'

export type ShopFilter = { shelf: Shelf; brand?: string; category?: string }
export const shelfLabels: Record<Shelf, string> = {
  catalogo: 'Todos os produtos',
  'mais-vendidos': 'Mais vendidos',
  novidades: 'Novidades',
  ofertas: 'Ofertas da semana',
}
type Props = {
  products: ShopProduct[]
  groups: ShopGroup[]
  filter: ShopFilter
  onFilter: (f: ShopFilter) => void
  status: string
  retry: () => void
  onOpen: (p: ShopProduct) => void
  favorites: Set<string> | null
  onFavorite: (p: ShopProduct) => void
  favoriteBusy: boolean
}
const recentKey = 'matilha:buscas:v1'
function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(recentKey) || '[]')
    return Array.isArray(value) ? value.filter((x) => typeof x === 'string').slice(0, 5) : []
  } catch {
    return []
  }
}
export function PublicProducts({
  products,
  groups,
  filter,
  onFilter,
  status,
  retry,
  onOpen,
  favorites,
  onFavorite,
  favoriteBusy,
}: Props) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<ShopSort>('relevancia')
  const [limit, setLimit] = useState(8)
  const [suggesting, setSuggesting] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
  const input = useRef<HTMLInputElement>(null)
  const group = groups.find((g) => g.id === filter.category)
  const base = useMemo(
    () =>
      products.filter(
        (p) =>
          (!filter.brand || p.marca === filter.brand) &&
          (!group || group.match(p)) &&
          onShelf(p, filter.shelf),
      ),
    [products, group, filter],
  )
  const index = useMemo(() => makeSearchIndex(base), [base])
  const matches = useMemo(() => {
    const rows = searchCatalog(
      index,
      query,
      sort === 'relevancia' && filter.shelf === 'novidades' ? 'novidades' : sort,
    )
    if (!query && sort === 'relevancia' && filter.shelf === 'mais-vendidos')
      rows.sort((a, b) => a.bestSellerRank! - b.bestSellerRank!)
    return rows
  }, [index, query, sort, filter.shelf])
  const allIndex = useMemo(() => makeSearchIndex(products), [products])
  const suggestions = useMemo(
    () =>
      query.trim()
        ? searchCatalog(allIndex, query, 'relevancia')
            .slice(0, 5)
            .map((p) => p.nome)
        : recent,
    [query, allIndex, recent],
  )
  function save(q: string) {
    const term = q.trim().slice(0, 80)
    if (!term) return
    const items = [term, ...readRecent().filter((x) => x !== term)].slice(0, 5)
    try {
      localStorage.setItem(recentKey, JSON.stringify(items))
    } catch {}
    setRecent(items)
  }
  function choose(s: string) {
    setQuery(s)
    setLimit(8)
    save(s)
    setSuggesting(false)
    input.current?.focus()
  }
  function clear() {
    setQuery('')
    setLimit(8)
    onFilter({ shelf: 'catalogo' })
  }
  return (
    <section className="mp-section mp-shop" id="produtos" aria-labelledby="shop-title">
      <div className="mp-heading">
        <ShoppingBag className="mp-heading-icon" />
        <div>
          <h2 id="shop-title" tabIndex={-1}>
            Boutique Matilha Prado
          </h2>
          <p>Produtos disponíveis para o seu pet.</p>
        </div>
      </div>
      <div className="mp-shelves" aria-label="Coleções da vitrine">
        {(Object.keys(shelfLabels) as Shelf[]).map((s) => (
          <button
            key={s}
            aria-pressed={filter.shelf === s}
            onClick={() => {
              setQuery('')
              setLimit(8)
              onFilter({ shelf: s })
            }}
          >
            {shelfLabels[s]}
          </button>
        ))}
      </div>
      <div className="mp-shop-tools">
        <form
          role="search"
          className="mp-search"
          onSubmit={(e) => {
            e.preventDefault()
            save(query)
            setSuggesting(false)
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setSuggesting(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSuggesting(false)
          }}
        >
          <Search />
          <input
            ref={input}
            id="mp-search"
            type="search"
            autoComplete="off"
            maxLength={80}
            placeholder="Buscar por produto, marca ou categoria"
            aria-label="Buscar por produto, marca ou categoria"
            value={query}
            onFocus={() => {
              setRecent(readRecent())
              setSuggesting(true)
            }}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(8)
              setSuggesting(true)
            }}
          />
          {suggesting && suggestions.length > 0 && (
            <div className="mp-suggestions">
              <small>{query ? 'Sugestões' : 'Buscas recentes'}</small>
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => choose(s)}>
                  {s}
                  <ChevronRight />
                </button>
              ))}
            </div>
          )}
        </form>
        <label className="mp-sort">
          <SlidersHorizontal />
          <span className="sr-only">Ordenar produtos</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as ShopSort)}>
            <option value="relevancia">Relevância</option>
            <option value="menor">Menor preço</option>
            <option value="maior">Maior preço</option>
            <option value="novidades">Mais recentes</option>
          </select>
        </label>
      </div>
      {(filter.category || filter.brand) && (
        <button className="mp-chip" aria-label="Limpar filtro" onClick={clear}>
          {group?.label || filter.brand} ×
        </button>
      )}
      {status === 'loading' ? (
        <p role="status" className="mp-state">
          Carregando a vitrine…
        </p>
      ) : status === 'error' ? (
        <div className="mp-state" role="status">
          <p>O catálogo está temporariamente indisponível.</p>
          <button className="mp-text-link" onClick={retry}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          <p className="mp-count" role="status">
            {matches.length} {matches.length === 1 ? 'produto disponível' : 'produtos disponíveis'}
            {filter.shelf === 'mais-vendidos'
              ? ' · vendas concluídas nos últimos 30 dias'
              : filter.shelf === 'novidades'
                ? ' · adicionados nos últimos 30 dias'
                : ''}
          </p>
          {!matches.length && (
            <div className="mp-state">
              <Package />
              <p>
                {query
                  ? 'Nenhum produto encontrado. Tente uma marca ou uma palavra mais curta.'
                  : filter.shelf === 'ofertas'
                    ? 'Nenhuma oferta disponível agora.'
                    : filter.shelf === 'mais-vendidos'
                      ? 'Ainda não há vendas com estoque disponível para este ranking.'
                      : filter.shelf === 'novidades'
                        ? 'Nenhuma novidade com estoque nos últimos 30 dias.'
                        : 'Nenhum produto em estoque para esta seleção.'}
              </p>
              {(query || filter.shelf !== 'catalogo' || group || filter.brand) && (
                <button className="mp-text-link" onClick={clear}>
                  Ver todos os produtos
                </button>
              )}
            </div>
          )}
          <div className="mp-product-grid">
            {matches.slice(0, limit).map((p) => (
              <article className="mp-product" key={p.id}>
                <button
                  type="button"
                  className="mp-product-main"
                  onClick={() => {
                    save(query)
                    onOpen(p)
                  }}
                  aria-haspopup="dialog"
                >
                  <span className="mp-product-photo">
                    {p.imageUrl && !failedImages.has(p.id) ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        loading="lazy"
                        width="240"
                        height="200"
                        referrerPolicy="no-referrer"
                        onError={() => setFailedImages((s) => new Set(s).add(p.id))}
                      />
                    ) : (
                      <Package aria-hidden="true" />
                    )}
                    {hasOffer(p) && (
                      <small>
                        <Tag />
                        Oferta
                      </small>
                    )}
                  </span>
                  <span className="mp-product-body">
                    <small>{p.marca && p.marca !== SEM_MARCA ? p.marca : p.categoria}</small>
                    <strong>{p.nome}</strong>
                    <span>
                      {hasOffer(p) && <del>{money(p.preco)}</del>} <b>{money(price(p))}</b>
                    </span>
                    <small>
                      {p.variantes?.length ? p.variantes.length + ' variações' : 'Disponível'}
                    </small>
                  </span>
                </button>
                {favorites && (
                  <button
                    type="button"
                    className="mp-fav"
                    aria-pressed={favorites.has(p.id)}
                    aria-label={'Favoritar ' + p.nome}
                    disabled={favoriteBusy}
                    onClick={() => onFavorite(p)}
                  >
                    <Heart fill={favorites.has(p.id) ? 'currentColor' : 'none'} />
                  </button>
                )}
              </article>
            ))}
          </div>
          {matches.length > limit && (
            <button className="mp-btn mp-light" onClick={() => setLimit(limit + 12)}>
              Mostrar mais produtos
            </button>
          )}
        </>
      )}
    </section>
  )
}
