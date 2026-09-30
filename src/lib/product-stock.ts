export type StockSources = {
  estoqueHub?: number | null
  estoqueZetta?: number | null
  estoqueMercadoLivre?: number | null
  estoqueAmazon?: number | null
}

export type ProductStockSources = StockSources & {
  zettaProCod?: number | null
  mlItemId?: string | null
  amazonAsin?: string | null
}

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function safeStock(value?: number | null) {
  const number = Number(value || 0)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.floor(number))
}

export function isUnlimitedBathProduct(product: {
  nome?: string | null
  categoria?: string | null
}) {
  const nome = normalizeText(product.nome)
  const categoria = normalizeText(product.categoria)

  const bathServiceName =
    nome === 'banho' ||
    nome === 'banho e tosa' ||
    nome.startsWith('banho e tosa ') ||
    nome.startsWith('banho +')

  return bathServiceName || (categoria.includes('servic') && /(^|\s)banho(\s|$)/.test(nome))
}

/**
 * Soma contábil dos saldos informados por cada origem.
 *
 * IMPORTANTE: este total NÃO representa o estoque físico disponível quando o
 * mesmo produto aparece em mais de um canal. Use officialStockFromSources para
 * disponibilidade/checkout.
 */
export function totalStockFromSources(stock: StockSources) {
  return (
    safeStock(stock.estoqueHub) +
    safeStock(stock.estoqueZetta) +
    safeStock(stock.estoqueMercadoLivre) +
    safeStock(stock.estoqueAmazon)
  )
}

/**
 * Estoque operacional/oficial do produto.
 *
 * Regra central da Matilha Prado:
 * 1. Produto vinculado ao Zetta -> Zetta é a fonte oficial.
 * 2. Sem Zetta, estoque próprio do Hub tem prioridade.
 * 3. Sem fonte central, usa o maior saldo entre marketplaces como fallback,
 *    nunca a soma, para não duplicar fisicamente o mesmo item.
 */
export function officialStockFromSources(stock: ProductStockSources) {
  if (stock.zettaProCod != null) {
    return safeStock(stock.estoqueZetta)
  }

  const hub = safeStock(stock.estoqueHub)
  if (hub > 0) return hub

  const mercadoLivre = safeStock(stock.estoqueMercadoLivre)
  const amazon = safeStock(stock.estoqueAmazon)

  return Math.max(mercadoLivre, amazon)
}

export function stockAccounting(stock: StockSources) {
  const zetta = safeStock(stock.estoqueZetta)
  const mercadoLivre = safeStock(stock.estoqueMercadoLivre)
  const amazon = safeStock(stock.estoqueAmazon)
  const hub = safeStock(stock.estoqueHub)

  return {
    zetta,
    mercadoLivre,
    amazon,
    hub,
    reportedTotal: zetta + mercadoLivre + amazon + hub,
  }
}
