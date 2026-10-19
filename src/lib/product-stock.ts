export type StockSources = {
  estoque?: number | null
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

export function isServiceProduct(product: {
  nome?: string | null
  categoria?: string | null
  estoqueIlimitado?: boolean | null
}) {
  if (product.estoqueIlimitado) return true

  const nome = normalizeText(product.nome)
  const categoria = normalizeText(product.categoria)
  if (categoria.includes('servic')) return true

  // Serviços do Zetta chegam com nomes detalhados e categoria genérica
  // ("Pet Shop"). Reconhecemos somente prefixos de serviços para não ocultar
  // produtos físicos como "spray banho a seco".
  const serviceName =
    /^(banho(?:\s|$)|tosa(?:\s|$)|hidratacao(?:\s|$)|trimming(?:\s|$)|remocao(?:\s|$)|desembolo(?:\s|$)|vapor de ozonio(?:\s|$)|corte de unha(?:\s|$)|escovacao de dentes(?:\s|$)|pct .*banho|pct .*escovacao)/

  return (
    serviceName.test(nome) ||
    nome === 'consulta' ||
    nome === 'consulta veterinaria' ||
    nome === 'vacinacao' ||
    nome === 'vacina' ||
    nome === 'spa pet'
  )
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
 * Estoque oficial é o saldo persistido no ERP Matilha Prado (Produto.estoque).
 * Os saldos recebidos dos canais são apenas informativos; nunca são somados.
 * Compatibilidade: fixtures sem campo estoque usam o saldo local do Hub.
 */
export function officialStockFromSources(stock: ProductStockSources) {
  if (stock.estoque != null) return safeStock(stock.estoque)
  if (stock.estoqueHub != null) return safeStock(stock.estoqueHub)
  return Math.max(safeStock(stock.estoqueMercadoLivre), safeStock(stock.estoqueAmazon))
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
