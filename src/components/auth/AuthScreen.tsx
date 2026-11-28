'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, House, Search, ShoppingBag, ShoppingCart, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { AccountExperience } from '@/components/auth/AccountExperience'
import type { AccountMode, AccountRole } from '@/components/auth/AccountForm'
import { useAuth } from '@/components/providers/AuthProvider'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { DraggableWhatsAppHelp } from '@/components/cliente-portal/DraggableWhatsAppHelp'
import { ClientBlog } from '@/components/cliente-portal/ClientBlog'
import { ProductDetailsDialog } from '@/components/products/ProductDetailsDialog'
import { PublicProducts, type ShopFilter } from '@/components/landing/PublicProducts'
import { CategoryNav, BrandNav } from '@/components/landing/ShopNavigation'
import { SpaBanner, StoreHero } from '@/components/landing/StoreHero'
import { Campaigns, CareDetails, PlansRibbon } from '@/components/landing/StoreCare'
import { StoreFooter, Wordmark } from '@/components/landing/StoreFooter'
import { useStoreFeed } from '@/components/landing/useStoreFeed'
import { available, catalogGroups, type Shelf, type ShopProduct } from '@/lib/storefront-catalog'
import { activeSeason, seasonalCampaigns, type ShopInfo } from '@/lib/storefront-content'
import { rememberIntent, type ShopIntent } from '@/lib/storefront-intent'
import { SEM_MARCA } from '@/lib/product-brands'
import './storefront.css'

const empty: ShopProduct[] = []
const nav = [
  ['Loja', 'produtos'],
  ['Banho e Tosa', 'servicos'],
  ['Planos', 'planos'],
  ['Marcas', 'marcas'],
  ['Ofertas', 'ofertas'],
] as const
function moveTo(id: string, focus = false) {
  const el = document.getElementById(id)
  if (!el) return
  if (focus) {
    if (!el.hasAttribute('tabindex') && !el.matches('input,button,a')) el.tabIndex = -1
    el.focus({ preventScroll: true })
  }
  el.scrollIntoView({
    block: 'start',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
}
export function AuthScreen() {
  const { sessao, loading } = useAuth()
  const catalog = useStoreFeed<ShopProduct[]>('/api/public/produtos')
  const info = useStoreFeed<ShopInfo>('/api/public/vitrine')
  const products = useMemo(
    () => (Array.isArray(catalog.data) ? catalog.data.filter(available) : empty),
    [catalog.data],
  )
  const groups = useMemo(() => catalogGroups(products), [products])
  const categoryIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups])
  const [filter, setFilter] = useState<ShopFilter>({ shelf: 'catalogo' })
  const [revision, setRevision] = useState(0)
  const [initialVariant, setInitialVariant] = useState<string>()
  const [product, setProduct] = useState<ShopProduct | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<Set<string> | null>(null)
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [mode, setMode] = useState<AccountMode>('login')
  const [role, setRole] = useState<AccountRole>('CLIENTE')
  const [busy, setBusy] = useState(false)
  const [paused, setPaused] = useState(false)
  const [activeNav, setActiveNav] = useState('inicio')
  const trigger = useRef<HTMLElement | null>(null)
  const requested = useRef(false)
  const started = useRef(false)
  const isClient = sessao.user?.role === 'CLIENTE'
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActiveNav(e.target.id)
      },
      { rootMargin: '-5% 0px -60% 0px' },
    )
    for (const id of [
      'inicio',
      'categorias',
      'produtos',
      'planos',
      'servicos',
      'marcas',
      'blog',
      'depoimentos',
    ]) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!isClient) {
      setFavoriteIds(null)
      return
    }
    const controller = new AbortController()
    fetch('/api/cliente/preferencias', { cache: 'no-store', signal: controller.signal })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((rows) => {
        if (Array.isArray(rows) && !controller.signal.aborted)
          setFavoriteIds(new Set(rows.filter((p) => p.favorite).map((p) => p.produtoId)))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [isClient, sessao.user?.id])
  useEffect(() => {
    if (!loading && sessao.autenticado && requested.current && location.pathname === '/loja')
      location.assign('/')
  }, [loading, sessao.autenticado])
  useEffect(() => {
    if (started.current || catalog.status === 'loading') return
    const params = new URLSearchParams(location.search)
    const id = params.get('produto'),
      campaign = params.get('campanha')
    if (id && catalog.status === 'error') return
    started.current = true
    if (id) {
      const match = catalog.data?.find((p) => p.id === id || p.variantes?.some((v) => v.id === id))
      if (match) {
        setProduct(match)
        setInitialVariant(id)
      } else {
        moveTo('produtos', true)
        toast.info('Este produto saiu da vitrine.')
      }
    } else if (campaign) {
      const season = activeSeason()
      const shelf = season && campaign === season ? seasonalCampaigns[season].destination : campaign
      if (shelf === 'novidades' || shelf === 'ofertas') {
        setFilter({ shelf })
        moveTo('produtos', true)
      }
    }
  }, [catalog.status, catalog.data])
  function account(
    intent: ShopIntent = { destination: 'perfil' },
    m: AccountMode = 'login',
    r: AccountRole = 'CLIENTE',
  ) {
    trigger.current = document.activeElement as HTMLElement
    rememberIntent(r === 'CLIENTE' ? intent : null)
    if (sessao.autenticado) {
      location.assign('/')
      return
    }
    requested.current = true
    setMode(m)
    setRole(r)
    setDialog(true)
  }
  async function favorite(p: ShopProduct) {
    if (favoriteBusy || !favoriteIds) return
    const liked = !favoriteIds.has(p.id)
    setFavoriteBusy(true)
    try {
      const response = await fetch('/api/cliente/preferencias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produtoId: p.id, favorite: liked }),
      })
      if (!response.ok) throw new Error()
      setFavoriteIds((before) => {
        const next = new Set(before)
        if (liked) next.add(p.id)
        else next.delete(p.id)
        return next
      })
    } catch {
      toast.error('Não foi possível atualizar seus favoritos.')
    } finally {
      setFavoriteBusy(false)
    }
  }
  function shop(shelf: Shelf = 'catalogo', category?: string, brand?: string) {
    setFilter({ shelf, category, brand })
    setRevision((n) => n + 1)
    requestAnimationFrame(() => moveTo('produtos', true))
  }
  function search() {
    moveTo('mp-search', true)
  }
  function book() {
    account({ destination: 'agendamentos' })
  }
  function navTo(id: string) {
    if (id === 'ofertas') shop('ofertas')
    else if (id === 'produtos') shop()
    else moveTo(id, true)
  }
  const related = product
    ? products
        .filter(
          (p) =>
            p.id !== product.id &&
            (p.categoria === product.categoria ||
              (p.marca && p.marca !== SEM_MARCA && p.marca === product.marca)),
        )
        .slice(0, 4)
    : []
  return (
    <div className="mp-store">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="mp-header">
        <div className="mp-wrap">
          <a className="mp-home-link" href="#inicio" aria-label="Matilha Prado, início">
            <Wordmark />
          </a>
          <nav className="mp-nav" aria-label="Navegação principal">
            {nav.map(([name, id]) => (
              <button
                key={id}
                aria-current={
                  id === activeNav || (id === 'produtos' && activeNav === 'inicio')
                    ? 'location'
                    : undefined
                }
                onClick={() => navTo(id)}
              >
                {name}
              </button>
            ))}
          </nav>
          <div className="mp-tools">
            {!sessao.autenticado && (
              <button
                className="mp-register"
                onClick={() => account({ destination: 'perfil' }, 'cadastro')}
              >
                Cadastrar
              </button>
            )}
            <button aria-label="Buscar produtos" onClick={search}>
              <Search />
            </button>
            <button aria-label="Minha conta" onClick={() => account()}>
              <UserRound />
            </button>
            <button aria-label="Abrir carrinho" onClick={() => account({ destination: 'carrinho' })}>
              <ShoppingCart />
            </button>
          </div>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1}>
        <StoreHero
          paused={paused}
          onPause={() => setPaused((v) => !v)}
          onShop={shop}
          onBook={book}
          onSpa={() => moveTo('servicos', true)}
          categories={categoryIds}
        />
        <div className="mp-wrap mp-body">
          <CategoryNav
            groups={groups}
            offers={products.some(
              (p) => p.precoPromo != null && p.precoPromo > 0 && p.precoPromo < p.preco,
            )}
            onSelect={(id) => shop('catalogo', id)}
            onOffers={() => shop('ofertas')}
            onServices={() => moveTo('servicos', true)}
          />
          <SpaBanner paused={paused} onOpen={() => moveTo('servicos', true)} />
          <BrandNav products={products} onSelect={(b) => shop('catalogo', undefined, b)} />
          <PlansRibbon onOpen={() => moveTo('planos', true)} />
          <Campaigns info={info.data} onShop={shop} />
          <PublicProducts
            key={revision}
            products={products}
            groups={groups}
            filter={filter}
            onFilter={setFilter}
            status={catalog.status}
            retry={catalog.retry}
            onOpen={setProduct}
            favorites={favoriteIds}
            onFavorite={favorite}
            favoriteBusy={favoriteBusy}
          />
          <CareDetails
            info={info.data}
            loading={info.status === 'loading'}
            retry={info.retry}
            onBook={book}
            onPlan={(id) => account({ destination: 'planos', id })}
          />
          <section id="blog" className="mp-section">
            <ClientBlog
              publicView
              onBook={book}
              onProduct={(id) => {
                const p = products.find((p) => p.id === id || p.variantes?.some((v) => v.id === id))
                if (p) setProduct(p)
                else shop()
              }}
            />
          </section>
          <StoreFooter
            onRegister={() => account({ destination: 'perfil' }, 'cadastro')}
            onStaff={() => account({ destination: 'perfil' }, 'login', 'ADMIN')}
            onStaffRegister={() => account({ destination: 'perfil' }, 'cadastro', 'ADMIN')}
          />
        </div>
      </main>
      <nav className="mp-bottom" aria-label="Atalhos no celular">
        <button
          aria-current={activeNav === 'inicio' ? 'location' : undefined}
          onClick={() => moveTo('inicio', true)}
        >
          <House />
          Início
        </button>
        <button aria-current={activeNav === 'produtos' ? 'location' : undefined} onClick={() => shop()}>
          <ShoppingBag />
          Produtos
        </button>
        <button onClick={book}>
          <CalendarDays />
          Agendar
        </button>
        <button onClick={() => account({ destination: 'carrinho' })}>
          <ShoppingCart />
          Carrinho
        </button>
        <button onClick={() => account()}>
          <UserRound />
          Perfil
        </button>
      </nav>
      <DraggableWhatsAppHelp publicStore />
      <ProductDetailsDialog
        initialVariant={initialVariant}
        product={product}
        open={!!product}
        related={related}
        onRelated={setProduct}
        onOpenChange={(v) => {
          if (!v) {
            setProduct(null)
            setInitialVariant(undefined)
          }
        }}
        onLoginToBuy={(id) => account({ destination: 'loja', id: id || product?.id })}
        buyLabel={isClient ? 'Comprar na minha conta' : undefined}
      />
      <Dialog
        open={dialog}
        onOpenChange={(v) => {
          if (!busy) {
            setDialog(v)
            if (!v) {
              requested.current = false
              rememberIntent(null)
            }
          }
        }}
      >
        <DialogContent
          className="account-dialog"
          showCloseButton={!busy}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true })
          }}
        >
          <DialogTitle className="sr-only">Acesso à Matilha Prado</DialogTitle>
          <DialogDescription className="sr-only">
            Entre ou crie sua conta para continuar.
          </DialogDescription>
          <AccountExperience
            key={mode + role}
            initialMode={mode}
            initialRole={role}
            onSuccess={() => {
              setDialog(false)
              if (location.pathname === '/loja') location.assign('/')
            }}
            onBusyChange={setBusy}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
