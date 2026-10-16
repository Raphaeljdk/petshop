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
  modeloLabel?: string | null
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

export const CLOTHING_SIZES = ['P', 'M', 'G', 'GG'] as const

/** Grade visual comum para todas as roupas. PP/XGG continuam disponíveis quando
 * há um anúncio real desses tamanhos; a grade não cria SKUs nem saldo.
 */
export function clothingSizeOptions(existing: Array<string | null | undefined>) {
  const extras = ['PP', 'XGG'].filter((size) => existing.includes(size))
  return [...extras.filter((size) => size === 'PP'), ...CLOTHING_SIZES, ...extras.filter((size) => size === 'XGG')]
}

/** Reconhece vestuário também quando o marketplace usa categorias genéricas. */
export function isClothingProduct(product: { nome?: string | null; categoria?: string | null }) {
  const name = key(product.nome || '')
  const category = key(product.categoria || '')
  const clothes = /\b(?:roupas?|roupinhas?|vestidos?|jaquetas?|casacos?|camisetas?|camisas?|blusas?|moletons?|pijamas?|macacoes?|macacao|fantasias?|sueteres?|sueter|coletes?|regatas?|saias?|calcas?|jardineiras?|shorts?|bermudas?|agasalhos?|puffers?|vestuario|capa de chuva|corta vento|conjuntos?)\b/
  return clothes.test(name) || /\b(?:roupas?|roupinhas?|vestuario|moda pet|vestimentas?)\b/.test(category)
}

/**
 * Equivalências de anúncio encontradas no catálogo da Matilha Prado.
 * São famílias identificadas por termos distintivos (não apenas "brinquedo"
 * ou "casinha"), para não misturar itens fisicamente diferentes.
 */
function catalogFamilyName(nome: string): string | null {
  const normalized = key(nome)
  if (/^brinquedo mordedor pelucia emite som caes gatos pets leve\b/.test(normalized)) {
    return 'Brinquedo Mordedor Pelúcia Emite Som Cães Gatos Pets Leve'
  }
  if (/^casinha coracao cotele\b/.test(normalized)) return 'Casinha Coração Cotelê'
  if (/^brinquedo p gatos catnip erva natural bolinha giratoria\b/.test(normalized)) {
    return 'Brinquedo para Gatos Catnip Erva Natural Bolinha Giratória'
  }
  if (/^moletom maxi sport\b/.test(normalized)) return 'Moletom Maxi Sport'
  if (/^jaqueta puffer pet rosa azul metalizado reforcada\b/.test(normalized) ||
      /^jaqueta puffer pet metalizado reforcada\b/.test(normalized)) {
    return 'Jaqueta Puffer Pet Metalizado Reforçada'
  }
  if (/\bdonutz\b/.test(normalized) && /\bzippypaws\b/.test(normalized) &&
      /\b(?:pelucia|brinquedo)\b/.test(normalized)) {
    return 'Pelúcia Donutz Zippypaws'
  }
  if (/^jaqueta puffer urso rosa ou azul\b/.test(normalized)) return 'Jaqueta Puffer Urso'
  return null
}

const MODEL_WORDS = '(?:hipop[oó]tamo|tubar[aã]o|jacar[eé]|pato|elefante|girafa|dinossauro|coelho|ursinho|baleia|le[aã]o|macaco|unic[oó]rnio|porquinho)'
const COLOR_WORDS = COLORS
const COLOR_MODIFIER = '(?:chiclete|celeste|beb[eê]|claro|clara|escuro|escura|marinho|royal|pastel|perolado|perolada)'
const COLOR_TOKEN = '(' + COLOR_WORDS + '(?:[-\\s]+' + COLOR_MODIFIER + ')?)'
const END_COLOR_MODEL = new RegExp('\\s+' + COLOR_TOKEN + '\\s+(' + MODEL_WORDS + ')$', 'i')
const END_COLOR = new RegExp('(?:\\s+|\\/)' + COLOR_TOKEN + '$', 'i')
const TRAILING_MODEL = new RegExp('\\b(' + MODEL_WORDS + ')$', 'i')
const COLORS_IN_NAME = new RegExp('\\b' + COLOR_WORDS + '(?:[-\\s]+' + COLOR_MODIFIER + ')?\\b', 'gi')

function canonicalColor(value: string) {
  return niceColor(value).replace(/ +/g, ' ').trim()
}

function capitalizeModel(value: string) {
  return value.slice(0, 1).toLocaleUpperCase('pt-BR') + value.slice(1).toLocaleLowerCase('pt-BR')
}

/** Título da família + atributos de uma variação física real. */
export function catalogVariantDetails(nome: string) {
  const original = (nome || '').replace(/\s*\/\s*(PP|P|M|G|GG|XGG)\s*$/i, ' $1').replace(/\s+/g, ' ').trim()
  const parts = original.split(/\s+[-–—]\s+/)
  const sizeFromEnd = original.match(END_SIZE)
  const size = canonicalSize(sizeFromEnd?.[1])
  let title = parts[0] || original
  // Os anúncios podem colocar tamanho depois de /, - ou junto de uma lista.
  title = title.replace(SIZE_LIST, '').replace(SINGLE_SIZE, '')
  let body = original.replace(SIZE_LIST, '').replace(SINGLE_SIZE, '').trim()

  let color: string | null = null
  let model: string | null = null
  const lastColorModel = body.match(END_COLOR_MODEL)
  if (lastColorModel) {
    color = canonicalColor(lastColorModel[1])
    model = capitalizeModel(lastColorModel[2])
    body = body.slice(0, lastColorModel.index).trim()
  } else {
    const lastColor = body.match(END_COLOR)
    if (lastColor) {
      color = canonicalColor(lastColor[1])
      body = body.slice(0, lastColor.index).trim()
    }
  }

  // Sufixos de variação depois de " - ", sem descartar o modelo da família.
  const tail = parts.slice(1).join(' ')
  const tailColors = Array.from(tail.matchAll(COLORS_IN_NAME))
  if (!color && tailColors.length) color = canonicalColor(tailColors[tailColors.length - 1][0])
  if (!model && /\b(?:mordedor|pel[uú]cia|brinquedo)\b/i.test(original)) {
    const tailModel = original.match(TRAILING_MODEL)
    if (tailModel && (color || tail.length > 0)) model = capitalizeModel(tailModel[1])
  }
  if (!color && /\bdonutz\b/i.test(original)) {
    const matches = Array.from(original.matchAll(COLORS_IN_NAME))
    if (matches.length) color = canonicalColor(matches[matches.length - 1][0])
  }

  const family = catalogFamilyName(original)
  if (family) {
    title = family
    // A forma "Rosa Ou Azul" indica cores disponíveis, não parte do nome.
  } else {
    title = title.replace(COLOR_CHOICES, '')
    const prefixPart = body.split(/\s+[-–—]\s+/)[0]
    if (prefixPart) {
      // Retira apenas a cor/modelo no FINAL do nome; "urso rosa" ou
      // outras palavras de características no meio são preservadas.
      title = prefixPart
    }
    // Cor+modelo no final em anúncios sem separador, ex. Lilás Hipopótamo.
    title = title.replace(END_COLOR_MODEL, '').replace(END_COLOR, '')
    title = title.replace(COLOR_CHOICES, '')
    title = title.replace(SIZE_LIST, '').replace(SINGLE_SIZE, '')
  }

  title = title.replace(/[\s,(/–—-]+$/, '').trim() || original
  return { title, size, color, model }
}

/** Interface legada: preservada para as demais áreas e testes existentes. */
export function catalogVariantInfo(nome: string) {
  const { title, size, color } = catalogVariantDetails(nome)
  return { title, size, color }
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
    const title = catalogVariantDetails(item.nome).title
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
      const info = catalogVariantDetails(item.nome)
      const dimension = key(info.model || '') + '|' + key(info.color || '') + '|' + (info.size || '')
      const previous = distinct.get(dimension)
      if (!previous || priority(item, previous) < 0) distinct.set(dimension, item)
    }

    const selected = Array.from(distinct.values()).sort(priority)
    const primary = selected[0]
    const info = catalogVariantDetails(primary.nome)
    const variants: CatalogVariant<T>[] = selected.map((item) => {
      const variant = catalogVariantDetails(item.nome)
      return {
        ...item,
        variacaoLabel: variant.size,
        corLabel: variant.color,
        modeloLabel: variant.model,
      }
    })

    // A quantidade exibida é soma das variações físicas únicas. Se existir uma
    // versão sem tamanho misturada às numeradas, seu saldo é tratado como
    // possível espelho, nunca somado novamente aos tamanhos.
    const colorBuckets = new Map<string, CatalogVariant<T>[]>()
    for (const item of variants) {
      const colorKey = key(item.modeloLabel || '') + ':' + key(item.corLabel || '')
      const bucket = colorBuckets.get(colorKey) || []
      bucket.push(item)
      colorBuckets.set(colorKey, bucket)
    }
    const bucketStock = (items: CatalogVariant<T>[]) => {
      const sized = items.filter((item) => item.variacaoLabel)
      const unsized = items.filter((item) => !item.variacaoLabel)
      const sizedStock = sized.reduce((sum, item) => sum + Math.max(0, item.estoque), 0)
      const unsizedStock = unsized.reduce((sum, item) => sum + Math.max(0, item.estoque), 0)
      return sized.length ? Math.max(sizedStock, unsizedStock) : unsizedStock
    }
    const namedColorStock = Array.from(colorBuckets.entries())
      .filter(([dimension]) => dimension !== ':')
      .reduce((sum, [, items]) => sum + bucketStock(items), 0)
    // Se há item sem cor e versões com cor, ele pode ser o mesmo estoque.
    const unknownColorStock = bucketStock(colorBuckets.get(':') || [])
    const stock = Math.max(namedColorStock, unknownColorStock)

    return {
      ...primary,
      nome: info.title,
      variacaoLabel: info.size,
      corLabel: info.color,
      modeloLabel: info.model,
      estoque: stock,
      estoqueIlimitado: variants.some((item) => Boolean(item.estoqueIlimitado)),
      ...(variants.length > 1 ? { variantes: variants } : {}),
    }
  })
}
