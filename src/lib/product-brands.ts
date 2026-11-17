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

const BRAND_ALIASES: ReadonlyArray<{ brand: string; aliases: string[] }> = [
  { brand: 'Arm & Hammer', aliases: ['arm & hammer', 'arm and hammer', 'arm hammer'] },
  { brand: 'Bonito Pra Cachorro', aliases: ['bonito pra cachorro', 'bonito para cachorro', 'bonito p cachorro'] },
  { brand: 'Great Pets', aliases: ['great pets', 'great pet'] },
  { brand: 'Jambo Pet', aliases: ['jambo pet', 'jambo'] },
  { brand: 'Alecrim Pet', aliases: ['alecrim pet'] },
  { brand: 'Pet Head', aliases: ['pet head'] },
  { brand: 'ZippyPaws', aliases: ['zippypaws'] },
  { brand: 'Chuckit', aliases: ['chuckit'] },
  { brand: 'Carnilove', aliases: ['carnilove'] },
  { brand: 'Yowup', aliases: ['yowup'] },
  { brand: 'Kong', aliases: ['kong'] },
  { brand: 'Petlon', aliases: ['petlon'] },
  { brand: 'Hydra', aliases: ['hydra'] },
]

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

function recognizableBrand(value: string): string | null {
  const text = ' ' + normalize(value) + ' '
  for (const { brand, aliases } of BRAND_ALIASES) {
    if (aliases.some((alias) => text.includes(' ' + normalize(alias) + ' '))) return brand
  }
  return null
}

export function getProductBrand(product: BrandableProduct): string {
  const original = product.marca?.trim() || ''
  // Marca explícita verificada é sempre preferida a menções em descrição.
  const knownExplicit = recognizableBrand(original)
  if (knownExplicit) return knownExplicit
  // Os títulos de anúncios trazem a marca real mesmo quando o conector não a informa.
  const byTitle = recognizableBrand(product.nome)
  if (byTitle) return byTitle
  if (original && original.length <= 80 &&
    !/^(?:0|sem marca|nao informado|não informado|outros?|pet shop|generico|genérico|animal_[a-z_]+)$/i.test(original)) {
    return original
  }
  // Descrição é a última opção: compatibilidade e outras marcas podem aparecer ali.
  return recognizableBrand(product.descricao || '') || SEM_MARCA
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
