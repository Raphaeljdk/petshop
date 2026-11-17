/**
 * Marca exibida na vitrine: prioriza a marca informada pelo ERP Zetta.
 * Para anúncios que não fornecem marca, reconhece apenas nomes conhecidos
 * encontrados no catálogo da Matilha Prado; não inventa fabricantes.
 * Não altera cadastro, integrações, SKUs nem preços.
 */
export const SEM_MARCA = 'Marca não identificada'

export type BrandableProduct = {
  nome: string
  descricao?: string | null
  marca?: string | null
  /** Os títulos originais das variações podem conter uma marca removida do título agrupado. */
  variantes?: readonly BrandableProduct[]
}

/** Marcas reais presentes nas integrações e linhas comprovadas do catálogo. */
const BRANDS = [
  'Bonito pra Cachorro',
  'Great Pet',
  'Arm & Hammer',
  'Alecrim Pet',
  'Jambo Pet',
  'Pet Head',
  'ZippyPaws',
  'Chuckit',
  'Carnilove',
  'Yowup',
  'Kong',
  'Petlon',
  'Hydra',
] as const

const BRAND_ALIASES: Record<string, readonly string[]> = {
  'Bonito pra Cachorro': ['bonito pra cachorro', 'bonito para cachorro', 'bonito p cachorro', 'moletom maxi sport', 'casaco coelho laco branco', 'cama linho clean'],
  // A linha de tapetes Tapetim e as grafias Great Pets/Greet Pet apontam para Great Pet.
  'Great Pet': ['great pet', 'great pets', 'greatpets', 'greet pet', 'greet pets', 'tapetim'],
  'Arm & Hammer': ['arm hammer', 'arm and hammer'],
  'Alecrim Pet': ['alecrim pet', 'alecrimpet'],
  'Jambo Pet': ['jambo pet', 'jambopet'],
  'Pet Head': ['pet head', 'pethead'],
  'ZippyPaws': ['zippy paws', 'zippypaws'],
  'Chuckit': ['chuckit'],
  'Carnilove': ['carnilove'],
  'Yowup': ['yowup'],
  'Kong': ['kong'],
  'Petlon': ['petlon'],
  'Hydra': ['hydra'],
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

function recognizedBrand(value: string): string | null {
  const normalized = normalize(value)
  for (const brand of BRANDS) {
    if (BRAND_ALIASES[brand].some((alias) => normalize(alias) === normalized)) return brand
  }
  return null
}

function validBrand(value?: string | null): string | null {
  const original = value?.trim()
  if (!original || original.length > 80) return null
  if (/^(?:0|sem marca|marca não identificada|marca nao identificada|nao informado|não informado|outros?|pet shop|generico|genérico)$/i.test(original)) return null
  return recognizedBrand(original) || original
}

function brandsMentioned(text: string): string[] {
  const haystack = ` ${normalize(text)} `
  return BRANDS.filter((brand) =>
    BRAND_ALIASES[brand].some((alias) => haystack.includes(` ${normalize(alias)} `))
  )
}

export function getProductBrand(product: BrandableProduct): string {
  // A marca informada expressamente pelo ERP é prioritária.
  const informed = validBrand(product.marca)
  if (informed) return informed

  // O agrupamento da vitrine pode remover o fabricante após o hífen.
  // Identifique-o também nas variações físicas originais e no campo de marca delas.
  const variants = product.variantes || []
  const variantBrands = new Set(variants.map((variant) => validBrand(variant.marca)).filter(Boolean))
  if (variantBrands.size === 1) return [...variantBrands][0] as string
  if (variantBrands.size > 1) return SEM_MARCA

  const matched = new Set([
    ...brandsMentioned([product.nome, product.descricao || ''].join(' ')),
    ...variants.flatMap((variant) => brandsMentioned([variant.nome, variant.descricao || ''].join(' '))),
  ])
  // Se títulos equivalentes mencionarem fabricantes diferentes, exigir revisão.
  return matched.size === 1 ? [...matched][0] : SEM_MARCA
}

/**
 * Só apresenta uma foto de outro anúncio quando o título E o SKU original
 * coincidem, ou quando o SKU comum parece ser um GTIN físico. A seleção
 * conserva o cadastro e evita associar fotos de cores ou tamanhos diferentes.
 */
export function recoverCatalogImages<T extends {
  id: string
  nome: string
  sku?: string | null
  imageUrl?: string | null
}>(products: T[]): T[] {
  const byIdentity = new Map<string, Set<string>>()
  for (const product of products) {
    const sku = normalize(product.sku || '').replace(/ /g, '')
    if (!sku || !product.imageUrl) continue
    const gtin = /^\d{8}$|^\d{12,14}$/.test(sku)
    const key = `${sku}:${gtin ? '' : normalize(product.nome)}`
    const urls = byIdentity.get(key) || new Set<string>()
    urls.add(product.imageUrl)
    byIdentity.set(key, urls)
  }

  return products.map((product) => {
    if (product.imageUrl) return product
    const sku = normalize(product.sku || '').replace(/ /g, '')
    if (!sku) return product
    const gtin = /^\d{8}$|^\d{12,14}$/.test(sku)
    const urls = byIdentity.get(`${sku}:${gtin ? '' : normalize(product.nome)}`)
    // Múltiplas imagens conflitantes exigem revisão; nunca escolhe uma ao acaso.
    if (!urls || urls.size !== 1) return product
    return { ...product, imageUrl: [...urls][0] }
  })
}
