import { mercadoLivreAccessToken } from '@/lib/mercado-livre'

export class MercadoLivreFiscalError extends Error {
  constructor(message: string, public readonly httpStatus = 502) { super(message) }
}

export type MercadoLivreInvoice = {
  id: string | number
  status?: string
  transaction_status?: string
  invoice_number?: number | string
  invoice_series?: number | string
  issued_date?: string
  attributes?: {
    invoice_key?: string | null
    protocol?: string | null
    authorization_date?: string | null
    danfe_location?: string | null
    xml_location?: string | null
    environment_type?: string | null
  } | null
  fiscal_data?: { transaction_type?: string | null } | null
  errors?: Array<{ code?: string; description?: string }> | null
}

const prefix = 'https://api.mercadolibre.com'
export function onlyOrderId(raw: string) {
  if (!/^\d{8,20}$/.test(raw)) throw new MercadoLivreFiscalError('Identificador de pedido Mercado Livre inválido.', 400)
  if (!Number.isSafeInteger(Number(raw))) throw new MercadoLivreFiscalError('Identificador numérico do pedido excede o limite seguro. Emissão bloqueada.', 400)
  return raw
}
export function onlySellerId(raw: string) {
  if (!/^\d{5,20}$/.test(raw)) throw new MercadoLivreFiscalError('ID do vendedor não identificado.', 400)
  return raw
}
export function parseMeliInvoice(body: unknown): MercadoLivreInvoice | null {
  let entries: unknown[]
  if (Array.isArray(body)) entries = body
  else if (body && typeof body === 'object' && 'results' in body && Array.isArray((body as { results: unknown[] }).results)) entries = (body as { results: unknown[] }).results
  else if (body && typeof body === 'object' && 'invoices' in body && Array.isArray((body as { invoices: unknown[] }).invoices)) entries = (body as { invoices: unknown[] }).invoices
  else if (body && typeof body === 'object') entries = [body]
  else throw new MercadoLivreFiscalError('Resposta de consulta fiscal inesperada. Emissão bloqueada por segurança.')
  if (!entries.length) return null
  const objects = entries.filter((x): x is MercadoLivreInvoice => !!x && typeof x === 'object' && 'id' in x && ('status' in x || 'transaction_status' in x))
  if (objects.length !== entries.length) throw new MercadoLivreFiscalError('Formato de nota fiscal desconhecido. Confira pelo painel do Mercado Livre.')
  const sales = objects.filter(x => !x.fiscal_data?.transaction_type || x.fiscal_data.transaction_type.toLowerCase() === 'sale')
  if (sales.length > 1) throw new MercadoLivreFiscalError('Há múltiplas notas fiscais de venda associadas ao pedido. Concilie manualmente no Mercado Livre.', 409)
  // Se houver apenas notas de remessa/devolução não assumimos que o pedido ainda pode ser faturado.
  if (objects.length && !sales.length) throw new MercadoLivreFiscalError('Há documentos fiscais de outras operações. Confira no Faturador antes de emitir.', 409)
  return sales[0] || null
}

export type FiscalSnapshot = {
  origem: 'mercado_livre'
  status: 'autorizada' | 'cancelada' | 'erro' | 'processando' | 'pendente_conferencia'
  documentoId: string
  numero: number | null
  serie: number | null
  chaveAcesso: string | null
  protocolo: string | null
  autorizadaEm: Date | null
  erro: string | null
  xmlPath: string | null
  danfePath: string | null
}
function integer(raw: unknown): number | null {
  if (typeof raw !== 'number' && typeof raw !== 'string') return null
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}
function date(raw: unknown) {
  if (typeof raw !== 'string') return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}
export function snapshot(invoice: MercadoLivreInvoice): FiscalSnapshot {
  const raw = (invoice.transaction_status || invoice.status || '').toLowerCase()
  const attributes = invoice.attributes
  const chaveAcesso = attributes?.invoice_key && /^\d{44}$/.test(attributes.invoice_key) ? attributes.invoice_key : null
  const protocolo = attributes?.protocol?.trim() || null
  const numero = integer(invoice.invoice_number)
  const autorizada = raw === 'authorized' && !!chaveAcesso && !!protocolo && !!numero
  const status = autorizada ? 'autorizada' :
    ['canceled', 'cancelled'].includes(raw) ? 'cancelada' :
    ['rejected', 'error', 'denied', 'forbidden_disablement'].includes(raw) ? 'erro' :
    raw === 'authorized' ? 'pendente_conferencia' : 'processando'
  const desc = invoice.errors?.map(x => x.description || x.code).filter(Boolean).join('; ').slice(0, 450)
  return {
    origem: 'mercado_livre', status, documentoId: String(invoice.id), numero,
    serie: integer(invoice.invoice_series), chaveAcesso, protocolo,
    autorizadaEm: autorizada ? date(attributes?.authorization_date) || date(invoice.issued_date) : null,
    erro: status === 'erro' ? desc || 'Rejeição identificada no Faturador Mercado Livre.' : null,
    xmlPath: attributes?.xml_location || null, danfePath: attributes?.danfe_location || null,
  }
}
async function meliFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(prefix + path, {
    ...init, headers: { Authorization: 'Bearer ' + token, ...(init?.headers || {}) },
    cache: 'no-store', signal: AbortSignal.timeout(15_000),
  })
  return res
}
export async function consultarNotaMeli(rawOrderId: string) {
  const orderId = onlyOrderId(rawOrderId)
  const { token, sellerId: seller } = await mercadoLivreAccessToken()
  const sellerId = onlySellerId(String(seller))
  const res = await meliFetch('/users/' + sellerId + '/invoices/orders/' + orderId, token)
  if (res.status === 404) return null
  if (!res.ok) throw new MercadoLivreFiscalError('Consulta fiscal Mercado Livre indisponível (HTTP ' + res.status + '). Confira a permissão de Faturamento na aplicação.')
  let body: unknown
  try { body = await res.json() } catch { throw new MercadoLivreFiscalError('Resposta fiscal inválida. Emissão bloqueada.') }
  return parseMeliInvoice(body)
}
export async function pedirEmissaoMeli(rawOrderId: string) {
  const orderId = onlyOrderId(rawOrderId)
  const { token, sellerId: seller } = await mercadoLivreAccessToken()
  const sellerId = onlySellerId(String(seller))
  const res = await meliFetch('/users/' + sellerId + '/invoices/orders', token, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orders: [Number(orderId)] }),
  })
  if (!res.ok) {
    // Uma falha HTTP pode ter ocorrido APÓS o provedor receber o pedido: exigir consulta, nunca retry cego.
    throw new MercadoLivreFiscalError('Mercado Livre recusou/ficou indisponível na emissão (HTTP ' + res.status + '). Consulte a nota antes de tentar novamente.')
  }
  let body: unknown
  try { body = await res.json() } catch { throw new MercadoLivreFiscalError('O Mercado Livre respondeu, mas não retornou dados legíveis. Consulte o pedido antes de tentar novamente.') }
  const item = parseMeliInvoice(body)
  if (!item) throw new MercadoLivreFiscalError('Emissão recebida pelo Mercado Livre sem documento identificável. Concilie antes de repetir.')
  return item
}
export async function consultarPedidoMeli(rawOrderId: string) {
  const orderId = onlyOrderId(rawOrderId)
  const { token, sellerId: seller } = await mercadoLivreAccessToken()
  const sellerId = onlySellerId(String(seller))
  const res = await meliFetch('/orders/' + orderId, token)
  if (!res.ok) throw new MercadoLivreFiscalError('Não foi possível conferir dados e situação do pedido no Mercado Livre (HTTP ' + res.status + ').')
  const order = await res.json() as {
    seller?: { id?: number | string }, status?: string,
    pack_id?: number | string | null, paid_amount?: number,
    payments?: Array<{ status?: string }>
  }
  if (String(order.seller?.id || '') !== sellerId)
    throw new MercadoLivreFiscalError('Este pedido não pertence à conta Mercado Livre conectada.', 403)
  if (order.pack_id) {
    const packId = String(order.pack_id)
    if (!/^\\d{8,20}$/.test(packId)) throw new MercadoLivreFiscalError('Pack de pedido inválido.', 409)
    const resPack = await meliFetch('/packs/' + packId, token)
    if (!resPack.ok) throw new MercadoLivreFiscalError('Não foi possível conferir o pack de pedidos no Mercado Livre. Emissão bloqueada.')
    const pack = await resPack.json() as { orders?: Array<{ id?: number | string }> }
    if (!Array.isArray(pack.orders) || pack.orders.length !== 1 || String(pack.orders[0]?.id) !== orderId)
      throw new MercadoLivreFiscalError('Carrinho com múltiplas orders: emita NF-e agrupada pelo Faturador Mercado Livre. Esta integração não fragmenta um carrinho.', 409)
  }
  if (order.status !== 'paid' && !order.payments?.some(p => p.status === 'approved'))
    throw new MercadoLivreFiscalError('Pagamento do pedido não confirmado pelo Mercado Livre.', 409)
  return order
}
export function allowedMeliDocumentPath(path: string | null | undefined, sellerId: string, tipo: 'xml' | 'danfe') {
  if (!path || !path.startsWith('/users/' + onlySellerId(sellerId) + '/invoices/')) return null
  if (path.includes('..') || path.includes('?') || path.includes('#') || path.includes('//')) return null
  if (tipo === 'xml' && !/^\/users\/\d+\/invoices\/documents\/xml\/[\w/-]+$/.test(path)) return null
  if (tipo === 'danfe' && !/^\/users\/\d+\/invoices\/sites\/MLB\/documents\/danfe\/[\w/-]+$/i.test(path)) return null
  return path
}
export async function baixarDocumentoMeli(path: string, tipo: 'xml' | 'danfe') {
  const { token, sellerId } = await mercadoLivreAccessToken()
  const allowed = allowedMeliDocumentPath(path, String(sellerId), tipo)
  if (!allowed) throw new MercadoLivreFiscalError('Caminho do documento fiscal não permitido.', 403)
  const res = await meliFetch(allowed, token)
  if (!res.ok) throw new MercadoLivreFiscalError('Documento fiscal indisponível no Faturador (HTTP ' + res.status + ').')
  const bytes = await res.arrayBuffer()
  if (bytes.byteLength > 12_000_000) throw new MercadoLivreFiscalError('Documento excedeu limite de segurança.')
  const textStart = new TextDecoder().decode(bytes.slice(0, 150)).trimStart()
  if (tipo === 'xml' && !textStart.startsWith('<?xml') && !textStart.startsWith('<nfeProc') && !textStart.startsWith('<NFe'))
    throw new MercadoLivreFiscalError('Conteúdo retornado não parece ser um XML de NF-e.')
  if (tipo === 'danfe' && new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-')
    throw new MercadoLivreFiscalError('Conteúdo retornado não é um PDF.')
  return bytes
}
