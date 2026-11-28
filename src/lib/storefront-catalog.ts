import type { ProductPreview } from '@/components/products/ProductDetailsDialog'
import { MARCA_PERSONALIZAVEIS, SEM_MARCA } from './product-brands'

export type ShopProduct = ProductPreview & { createdAt?: string | null; bestSellerRank?: number }
export type Shelf = 'catalogo' | 'novidades' | 'ofertas' | 'mais-vendidos'
export type ShopSort = 'relevancia' | 'menor' | 'maior' | 'novidades'
export type ShopGroup = {
  id: string
  label: string
  art?: string
  match: (product: ShopProduct) => boolean
}
export const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
export const available = (p: ShopProduct) => Boolean(p.estoqueIlimitado || p.estoque > 0)
export const hasOffer = (p: ShopProduct) =>
  p.precoPromo != null && p.precoPromo > 0 && p.precoPromo < p.preco
export const price = (p: ShopProduct) => (hasOffer(p) ? p.precoPromo! : p.preco)
const inCategory = (pattern: RegExp) => (p: ShopProduct) => pattern.test(normalize(p.categoria))
const species = (pattern: RegExp) => (p: ShopProduct) =>
  pattern.test(normalize(p.categoria + ' ' + p.nome).replace(/bonito (?:pra|para) cachorro/g, ''))
export const shopGroups: ShopGroup[] = [
  {
    id: 'alimentacao',
    label: 'Alimentação',
    art: 'tigela',
    match: inCategory(
      /\b(alimentacao|alimentos?|racao|racoes|pet food|comedouros?|bebedouros?|pet feeder|animal water dispenser)\b/,
    ),
  },
  {
    id: 'higiene',
    label: 'Higiene e beleza',
    art: 'frasco',
    match: inCategory(
      /\b(higiene|beleza|cosmeticos?|shampoos?|banho|higienicas?|higienicos?|creme dental|animal litter|tooth cleaning agent|cleaning (?:agent|brush)|animal fur cleaner conditioner)\b/,
    ),
  },
  {
    id: 'brinquedos',
    label: 'Brinquedos',
    art: 'corda',
    match: inCategory(
      /\b(brinquedos?|mordedores?|pelucias?|bolinhas?|bolas?|frisbees?|pet toy|dispensadores de petiscos)\b/,
    ),
  },
  {
    id: 'acessorios',
    label: 'Roupas e acessórios',
    art: 'acessorios',
    match: inCategory(
      /\b(roupas?|acessorios?|vestuario|coleiras?|peitorais?|guias?|vestidos?|camas?|casas|pet apparel|animal carrier|pet bed mat|animal cage|animal stair)\b/,
    ),
  },
  {
    id: 'bem-estar',
    label: 'Saúde e bem-estar',
    art: 'bem-estar',
    match: inCategory(/\b(saude|bem estar|farmacia|suplementos?)\b/),
  },
  {
    id: 'petiscos',
    label: 'Petiscos',
    art: 'osso',
    match: (p) =>
      !/^dispensadores? de /i.test(p.categoria) &&
      inCategory(/\b(petiscos?|snacks?|biscoitos para caes|premios)\b/)(p),
  },
  { id: 'cachorros', label: 'Cachorros', match: species(/\b(cachorros?|cao|caes|caninos?)\b/) },
  { id: 'gatos', label: 'Gatos', match: species(/\b(gatos?|felinos?)\b/) },
  {
    id: 'personalizaveis',
    label: 'Personalizáveis',
    match: (p) =>
      p.marca === MARCA_PERSONALIZAVEIS || /\bpersonalizaveis\b/.test(normalize(p.categoria)),
  },
]

export function catalogGroups(products: ShopProduct[]) {
  const supported = shopGroups.filter((group) => products.some(group.match))
  const extra = [...new Set(products.map((p) => p.categoria).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .filter(
      (category) =>
        !shopGroups.some((group) => group.match({ nome: '', categoria: category } as ShopProduct)),
    )
    .map((category) => ({
      id: 'cat:' + category,
      label: category,
      match: (p: ShopProduct) => p.categoria === category,
    }))
  return [...supported, ...extra] as ShopGroup[]
}

// A single insertion, deletion, replacement or adjacent transposition in a catalog word.
function near(a: string, b: string) {
  if (a.length < 3 || Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (a.length === b.length)
    return (
      a.slice(i + 1) === b.slice(i + 1) ||
      (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
    )
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1)
}
export function makeSearchIndex(products: ShopProduct[]) {
  return products.map((product) => {
    const name = normalize(product.nome)
    const brand = product.marca && product.marca !== SEM_MARCA ? normalize(product.marca) : ''
    const category = normalize(product.categoria)
    return {
      product,
      name,
      brand,
      category,
      words: [...new Set((name + ' ' + brand + ' ' + category).split(' '))],
    }
  })
}
function matchScore(row: ReturnType<typeof makeSearchIndex>[number], query: string, tokens: string[]) {
  if (!query) return 1
  if (row.name === query) return 100
  if (row.name.startsWith(query)) return 80
  if (row.name.includes(query)) return 60
  if (row.brand === query || row.category === query) return 55
  let score = 0
  for (const token of tokens) {
    if (row.words.some((w) => w.startsWith(token))) score += 4
    else if (row.words.some((w) => near(token, w))) score += 1
    else return 0
  }
  return Math.min(45, score)
}
export function searchCatalog(index: ReturnType<typeof makeSearchIndex>, query: string, sort: ShopSort) {
  const q = normalize(query).slice(0, 80),
    tokens = q.split(' ').slice(0, 8)
  return index
    .map((row) => ({ product: row.product, score: matchScore(row, q, tokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => {
      if (sort === 'menor' || sort === 'maior')
        return (price(a.product) - price(b.product)) * (sort === 'menor' ? 1 : -1)
      if (sort === 'novidades')
        return (b.product.createdAt || '').localeCompare(a.product.createdAt || '')
      return b.score - a.score || a.product.nome.localeCompare(b.product.nome, 'pt-BR')
    })
    .map((row) => row.product)
}
export function onShelf(p: ShopProduct, shelf: Shelf, now = Date.now()) {
  if (shelf === 'ofertas') return hasOffer(p)
  if (shelf === 'mais-vendidos') return Boolean(p.bestSellerRank)
  if (shelf === 'novidades') {
    const age = now - Date.parse(p.createdAt || '')
    return age >= 0 && age <= 30 * 86400000
  }
  return true
}
