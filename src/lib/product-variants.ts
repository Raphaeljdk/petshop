/**
 * Normalização de títulos exibidos na loja. Não altera o cadastro original,
 * o SKU, o ID da plataforma nem a posição de estoque no Zetta.
 *
 * Uma única regra é usada na vitrine, na área do cliente e na gestão.
 */
export type CatalogVariantProduct = {
  id: string
  nome: string
  preco: number
  precoPromo: number | null
  estoque: number
  estoqueIlimitado?: boolean | null
  zettaProCod?: number | null
  mlItemId?: string | null
  amazonAsin?: string | null
}

export type CatalogVariant<T> = T & {
  variacaoLabel?: string | null
  corLabel?: string | null
}

export type CatalogGroup<T> = CatalogVariant<T> & {
  variantes?: CatalogVariant<T>[]
}

const SIZES = '(?:XXL|XGG|XXG|XL|XG|GG|PP|XS|SMALL|MEDIUM|LARGE|P|M|G)'
const COLORS = '(?:rosa|azul|lil[aá]s|roxo|roxa|preto|preta|branco|branca|verde|amarelo|amarela|vermelho|vermelha|cinza|bege|marrom|laranja|pink|dourado|dourada|prata|caramelo|vinho|nude|coral|creme|grafite|chumbo)'
const SIZE_PREFIX = '(?:(?:tamanhos?|tam\\.?|size)\\s*[:.]?\\s*)?'
const SIZE_LIST = new RegExp(
  '(?:\\s+|\\s*\\()' + SIZE_PREFIX + SIZES +
  '(?:\\s*(?:,|\\/|\\+|&|\\be\\b|\\bou\\b)\\s*' + SIZES + ')+' +
  '\\)?\\s*$', 'i'
)
const SINGLE_SIZE = new RegExp(
  '(?:\\s+|\\s*\\(|\\s*[-:,]\\s*)' + SIZE_PREFIX +
  '(' + SIZES + ')\\)?\\s*$', 'i'
)
const END_SIZE = new RegExp(
  '(?:^|[\\s(,:-])' + SIZE_PREFIX + '(' + SIZES + ')\\)?\\s*$', 'i'
)
const COLOR_CHOICES = new RegExp(
  '\\s+' + COLORS + '(?:\\s+(?:ou|e)\\s+|\\s*[/&]\\s*)' + COLORS + '\\s*$', 'i'
)
const COLOR_MATCH = new RegExp('\\b' + COLORS + '(?:[-\\s](?:chiclete|celeste|beb[eê]|claro|clara|escuro|escura|marinho|royal|pastel))?\\b', 'gi')

function key(value: string) {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function niceColor(value: string) {
  return value.toLocaleLowerCase('pt-BR')
    .replace(/(^|[-\s])([a-zà-ú])/gi, (_whole, space: string, letter: string) =>
      space + letter.toLocaleUpperCase('pt-BR')
    ).replace(/-/g, ' ')
}

function canonicalSize(value?: string | null) {
  if (!value) return null
  const size = value.toUpperCase()
  const aliases: Record<string, string> = {
    XS: 'PP', SMALL: 'P', MEDIUM: 'M', LARGE: 'G',
    XL: 'GG', XG: 'GG', XXL: 'XGG', XXG: 'XGG',
  }
  return aliases[size] || size
}

/**
 * Remove listas promocionais de tamanhos, tamanho de SKU e subtítulos após " - ".
 * Preserva cores no título, exceto quando o próprio título anuncia alternativas
 * ("Rosa ou Azul"), caso em que as cores passam a ser uma opção do produto.
 */
export function catalogVariantInfo(nome: string) {
  const original = (nome || '').replace(/\s+/g, ' ').trim()
  const parts = original.split(/\s+[-–—]\s+/)
  let first = parts[0] || original
  const specificSize = original.match(END_SIZE)
  const size = canonicalSize(specificSize?.[1])

  first = first.replace(SIZE_LIST, '').replace(SINGLE_SIZE, '')
  const hasColorChoices = COLOR_CHOICES.test(first)
  if (hasColorChoices) first = first.replace(COLOR_CHOICES, '')
  first = first.replace(/[\s,(/–—-]+$/, '').trim()

  // Mesmo quando o nome principal não informa cores, um sufixo
  // " - Rosa GG" precisa permanecer distinto de " - Azul PP".
  const tail = parts.slice(1).join(' ')
  const hits = Array.from(tail.matchAll(COLOR_MATCH))
  const color = hits.length ? niceColor(hits[hits.length - 1][0]) : null

  // Títulos impossíveis de limpar são mantidos, para nunca deixar um produto sem nome.
  return { title: first || original, size, color }
}

function priority<T extends CatalogVariantProduct>(a: T, b: T) {
  const zettaA = a.zettaProCod != null ? 1 : 0
  const zettaB = b.zettaProCod != null ? 1 : 0
  if (zettaA !== zettaB) return zettaB - zettaA
  const availableA = a.estoqueIlimitado || a.estoque > 0 ? 1 : 0
  const availableB = b.estoqueIlimitado || b.estoque > 0 ? 1 : 0
  if (availableA !== availableB) return availableB - availableA
  // Em anúncios duplicados, mantém-se a opção de maior valor.
  return (b.precoPromo ?? b.preco) - (a.precoPromo ?? a.preco)
}

export function groupCatalogProducts<T extends CatalogVariantProduct>(products: T[]): CatalogGroup<T>[] {
  const grouped = new Map<string, T[]>()
  for (const item of products) {
    const title = catalogVariantInfo(item.nome).title
    const groupKey = key(title) || item.id
    const rows = grouped.get(groupKey) || []
    rows.push(item)
    grouped.set(groupKey, rows)
  }

  return Array.from(grouped.values()).map((rows) => {
    // Mesmo tamanho e mesma cor são o MESMO item para a vitrine. Não se soma
    // estoque espelhado entre ML, Amazon e Zetta.
    const distinct = new Map<string, T>()
    for (const item of rows) {
      const info = catalogVariantInfo(item.nome)
      const dimension = key(info.color || '') + '|' + (info.size || '')
      const previous = distinct.get(dimension)
      if (!previous || priority(item, previous) < 0) distinct.set(dimension, item)
    }

    const selected = Array.from(distinct.values()).sort(priority)
    const primary = selected[0]
    const info = catalogVariantInfo(primary.nome)
    const variants: CatalogVariant<T>[] = selected.map((item) => {
      const variant = catalogVariantInfo(item.nome)
      return {
        ...item,
        variacaoLabel: variant.size,
        corLabel: variant.color,
      }
    })

    // A quantidade exibida é soma das variações físicas únicas. Se existir uma
    // versão sem tamanho misturada às numeradas, seu saldo é tratado como
    // possível espelho, nunca somado novamente aos tamanhos.
    const sized = variants.filter((item) => item.variacaoLabel)
    const unsized = variants.filter((item) => !item.variacaoLabel)
    const sizedStock = sized.reduce((sum, item) => sum + Math.max(0, item.estoque), 0)
    const unsizedStock = unsized.reduce((sum, item) => sum + Math.max(0, item.estoque), 0)
    const stock = sized.length > 0 ? Math.max(sizedStock, unsizedStock) : unsizedStock

    return {
      ...primary,
      nome: info.title,
      estoque: stock,
      estoqueIlimitado: variants.some((item) => Boolean(item.estoqueIlimitado)),
      ...(variants.length > 1 ? { variantes: variants } : {}),
    }
  })
}
