import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { ConfiguracaoPagamento } from '@/lib/types'

const MP_API_BASE = 'https://api.mercadopago.com'

export interface CardOrderData {
  token: string
  paymentMethodId: string
  paymentTypeId: string
  installments: number
  payer: {
    email: string
    identification?: {
      type?: string
      number?: string
    }
  }
}

export interface BoletoOrderData {
  email: string
  firstName: string
  lastName: string
  identification: {
    type: string
    number: string
  }
  address: {
    zipCode: string
    streetName: string
    streetNumber: string
    neighborhood: string
    city: string
    state: string
  }
}

export interface CriarOrderInput {
  vendaId: string
  total: number
  metodo: 'pix' | 'cartao' | 'boleto'
  payerEmail?: string | null
  card?: CardOrderData
  boleto?: BoletoOrderData
}

export interface OrderPagamentoResultado {
  orderId: string
  status: string
  statusDetail?: string
  paymentId?: string
  ticketUrl?: string
  qrCode?: string
  qrCodeBase64?: string
  pixExpiresAt?: string
  boletoLinhaDigitavel?: string
  boletoCodigoBarras?: string
  challengeUrl?: string
  simulado: boolean
  raw?: any
}

function tokenEfetivo(config: ConfiguracaoPagamento): string | null {
  const envToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim()
  if (envToken) return envToken

  const tokenBanco = config.mercadoPagoAccessToken?.trim()
  return tokenBanco || null
}

function mercadoPagoAtivo(config: ConfiguracaoPagamento): boolean {
  const env = process.env.MERCADO_PAGO_ENABLED?.trim().toLowerCase()

  if (env === 'false') return false
  if (env === 'true') return true

  // Quando existe token no ambiente do servidor, consideramos a integração
  // explicitamente configurada. O toggle do banco continua como fallback.
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim()) || config.mercadoPagoAtivo
}

export function checkoutTransparenteConfigurado(
  config: ConfiguracaoPagamento
): boolean {
  return mercadoPagoAtivo(config) && Boolean(tokenEfetivo(config))
}

function valor(valor: number): string {
  return Number(valor).toFixed(2)
}

function extrairMensagemErro(payload: any, status: number): string {
  const message =
    payload?.message ||
    payload?.error ||
    payload?.errors?.[0]?.message ||
    payload?.cause?.[0]?.description ||
    payload?.cause?.[0]?.code

  return message
    ? `Mercado Pago: ${message}`
    : `Mercado Pago retornou HTTP ${status}`
}

async function chamarMercadoPago(
  path: string,
  config: ConfiguracaoPagamento,
  init: RequestInit = {}
): Promise<any> {
  const token = tokenEfetivo(config)
  if (!token) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado no servidor')
  }

  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('Content-Type', 'application/json')
  headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${MP_API_BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(extrairMensagemErro(payload, response.status))
  }

  return payload
}

function pagamentoDaOrder(order: any): any {
  return order?.transactions?.payments?.[0] || null
}

function resultadoDaOrder(order: any): OrderPagamentoResultado {
  const payment = pagamentoDaOrder(order)
  const paymentMethod = payment?.payment_method || {}

  const base64 =
    paymentMethod?.qr_code_base64 ||
    paymentMethod?.qr_code_based64 ||
    undefined

  const qrCodeBase64 = base64
    ? String(base64).startsWith('data:')
      ? String(base64)
      : `data:image/png;base64,${base64}`
    : undefined

  return {
    orderId: String(order?.id || ''),
    status: String(order?.status || payment?.status || 'processing'),
    statusDetail: String(
      order?.status_detail || payment?.status_detail || ''
    ) || undefined,
    paymentId: payment?.id ? String(payment.id) : undefined,
    ticketUrl: paymentMethod?.ticket_url || undefined,
    qrCode: paymentMethod?.qr_code || undefined,
    qrCodeBase64,
    boletoLinhaDigitavel: paymentMethod?.digitable_line || undefined,
    boletoCodigoBarras: paymentMethod?.barcode_content || undefined,
    challengeUrl: paymentMethod?.transaction_security?.url || undefined,
    simulado: false,
    raw: order,
  }
}

function simulado(vendaId: string, metodo: CriarOrderInput['metodo']): OrderPagamentoResultado {
  return {
    orderId: `SIM-${vendaId.slice(-8).toUpperCase()}-${metodo}`,
    status: 'processing',
    statusDetail: 'simulation',
    simulado: true,
  }
}

export async function criarOrderMercadoPago(
  input: CriarOrderInput,
  config: ConfiguracaoPagamento
): Promise<OrderPagamentoResultado> {
  if (!checkoutTransparenteConfigurado(config)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Checkout Transparente não configurado. Configure o Access Token do Mercado Pago.'
      )
    }
    return simulado(input.vendaId, input.metodo)
  }

  const amount = valor(input.total)
  let payer: Record<string, any>
  let paymentMethod: Record<string, any>
  let expirationTime: string | undefined
  let orderConfig: Record<string, any> | undefined

  if (input.metodo === 'pix') {
    const email = input.payerEmail?.trim()
    if (!email) throw new Error('E-mail do pagador é obrigatório para PIX')

    payer = { email }
    paymentMethod = {
      id: 'pix',
      type: 'bank_transfer',
    }

    // O Mercado Pago aceita de 30 minutos a 30 dias para PIX.
    expirationTime = 'PT30M'
  } else if (input.metodo === 'cartao') {
    const card = input.card
    if (
      !card?.token ||
      !card.paymentMethodId ||
      !card.paymentTypeId ||
      !card.payer?.email
    ) {
      throw new Error('Dados do cartão incompletos')
    }

    payer = {
      email: card.payer.email,
      ...(card.payer.identification?.type &&
      card.payer.identification?.number
        ? {
            identification: {
              type: card.payer.identification.type,
              number: card.payer.identification.number,
            },
          }
        : {}),
    }

    paymentMethod = {
      id: card.paymentMethodId,
      type: card.paymentTypeId,
      token: card.token,
      installments: Math.max(1, Number(card.installments || 1)),
    }

    // 3DS sob risco: o challenge, quando exigido, continua dentro do site.
    orderConfig = {
      online: {
        transaction_security: {
          validation: 'on_fraud_risk',
          liability_shift: 'required',
        },
      },
    }
  } else {
    const boleto = input.boleto
    if (
      !boleto?.email ||
      !boleto.firstName ||
      !boleto.lastName ||
      !boleto.identification?.type ||
      !boleto.identification?.number ||
      !boleto.address?.zipCode ||
      !boleto.address?.streetName ||
      !boleto.address?.streetNumber ||
      !boleto.address?.neighborhood ||
      !boleto.address?.city ||
      !boleto.address?.state
    ) {
      throw new Error('Preencha todos os dados obrigatórios do boleto')
    }

    payer = {
      email: boleto.email,
      first_name: boleto.firstName,
      last_name: boleto.lastName,
      identification: {
        type: boleto.identification.type,
        number: boleto.identification.number.replace(/\D/g, ''),
      },
      address: {
        zip_code: boleto.address.zipCode.replace(/\D/g, ''),
        street_name: boleto.address.streetName,
        street_number: boleto.address.streetNumber || 'S/N',
        neighborhood: boleto.address.neighborhood,
        city: boleto.address.city,
        state: boleto.address.state.toUpperCase(),
      },
    }

    paymentMethod = {
      id: 'boleto',
      type: 'ticket',
    }

    expirationTime = 'P3D'
  }

  const payment: Record<string, any> = {
    amount,
    payment_method: paymentMethod,
  }

  if (expirationTime) payment.expiration_time = expirationTime

  const body: Record<string, any> = {
    type: 'online',
    processing_mode: 'automatic',
    total_amount: amount,
    external_reference: input.vendaId,
    payer,
    transactions: {
      payments: [payment],
    },
  }

  if (orderConfig) body.config = orderConfig

  const order = await chamarMercadoPago('/v1/orders', config, {
    method: 'POST',
    headers: {
      'X-Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify(body),
  })

  const resultado = resultadoDaOrder(order)

  if (!resultado.orderId) {
    throw new Error('Mercado Pago não retornou o identificador da order')
  }

  if (input.metodo === 'pix') {
    resultado.pixExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  }

  return resultado
}

export async function consultarOrderMercadoPago(
  orderId: string,
  config: ConfiguracaoPagamento
): Promise<OrderPagamentoResultado> {
  if (!orderId || orderId.startsWith('SIM-')) {
    throw new Error('Order do Mercado Pago inválida')
  }

  const order = await chamarMercadoPago(
    `/v1/orders/${encodeURIComponent(orderId)}`,
    config,
    { method: 'GET' }
  )

  return resultadoDaOrder(order)
}

export function mapearOrderParaVenda(
  status: string | null | undefined,
  statusDetail?: string | null
): {
  mercadoPagoStatus: string
  vendaStatus: 'concluida' | 'pendente' | 'cancelada'
  aprovado: boolean
  rejeitado: boolean
} {
  const s = String(status || '').toLowerCase()
  const detail = String(statusDetail || '').toLowerCase()

  if (s === 'processed' && (!detail || detail === 'accredited')) {
    return {
      mercadoPagoStatus: 'approved',
      vendaStatus: 'concluida',
      aprovado: true,
      rejeitado: false,
    }
  }

  if (
    ['failed', 'canceled', 'cancelled', 'expired', 'charged_back', 'refunded'].includes(s)
  ) {
    return {
      mercadoPagoStatus: 'rejected',
      vendaStatus: 'cancelada',
      aprovado: false,
      rejeitado: true,
    }
  }

  if (s === 'processing') {
    return {
      mercadoPagoStatus: 'in_process',
      vendaStatus: 'pendente',
      aprovado: false,
      rejeitado: false,
    }
  }

  return {
    mercadoPagoStatus:
      s === 'action_required' && detail === 'waiting_capture'
        ? 'authorized'
        : 'pending',
    vendaStatus: 'pendente',
    aprovado: false,
    rejeitado: false,
  }
}

export function webhookSecretConfigurado(): boolean {
  return Boolean(process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim())
}

export function validarAssinaturaWebhook(params: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string | null
}): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim()
  if (!secret) return true

  const { xSignature, xRequestId, dataId } = params
  if (!xSignature || !xRequestId || !dataId) return false

  let ts = ''
  let hash = ''

  for (const part of xSignature.split(',')) {
    const [key, value] = part.split('=', 2).map((v) => v?.trim())
    if (key === 'ts') ts = value || ''
    if (key === 'v1') hash = value || ''
  }

  if (!ts || !hash) return false

  // Para IDs alfanuméricos, a documentação do MP orienta validar em minúsculas.
  const normalizedDataId = dataId.toLowerCase()
  const manifest = `id:${normalizedDataId};request-id:${xRequestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(hash, 'utf8')

  return a.length === b.length && timingSafeEqual(a, b)
}
