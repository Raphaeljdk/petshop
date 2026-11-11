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
}

const BRANDS = [
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

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

export function getProductBrand(product: BrandableProduct): string {
  const original = product.marca?.trim()
  if (original && original.length <= 80 && !/^(?:0|sem marca|nao informado|não informado|outros?|pet shop|generico|genérico)$/i.test(original)) {
    return BRANDS.find((brand) => normalize(brand) === normalize(original)) || original
  }

  const text = ` ${normalize([product.nome, product.descricao || ''].join(' '))} `
  for (const brand of BRANDS) {
    if (text.includes(` ${normalize(brand)} `)) return brand
  }
  return SEM_MARCA
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
