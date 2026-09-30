export type StockSources = {
  estoqueHub?: number | null
  estoqueZetta?: number | null
  estoqueMercadoLivre?: number | null
  estoqueAmazon?: number | null
}

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function safeStock(value?: number | null) {
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

export function totalStockFromSources(stock: StockSources) {
  return (
    safeStock(stock.estoqueHub) +
    safeStock(stock.estoqueZetta) +
    safeStock(stock.estoqueMercadoLivre) +
    safeStock(stock.estoqueAmazon)
  )
}
