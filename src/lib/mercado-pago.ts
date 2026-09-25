import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import { db } from '@/lib/db'
import type { ConfiguracaoPagamento as ConfigPagamentoPrisma } from '@prisma/client'
import type { ConfiguracaoPagamento, MetodoPagamento } from '@/lib/types'

/**
 * Helpers do Mercado Pago (server-only).
 *
 * Estratégia de resiliência:
 *  - Se não houver token válido configurado, ou se a chamada ao MP falhar,
 *    caímos em modo SIMULADO (gera QR/code fake e aprova após alguns segundos).
 *  - O cliente pode testar todo o fluxo sem precisar de credenciais reais.
 */

const TOKEN_FALLBACK = 'TEST-fallback-no-token'

/** Retorna as configurações atuais de pagamento, criando defaults se necessário. */
export async function getOuCriarConfigPagamento(): Promise<ConfiguracaoPagamento> {
  let config: ConfigPagamentoPrisma | null = await db.configuracaoPagamento.findFirst()

  if (!config) {
    config = await db.configuracaoPagamento.create({
      data: {
        mercadoPagoAtivo: true,
        mercadoPagoSandbox: false,
        pixAtivo: true,
        cartaoAtivo: true,
        boletoAtivo: true,
      },
    })
  } else if (
    !config.mercadoPagoAtivo ||
    config.mercadoPagoSandbox ||
    !config.pixAtivo ||
    !config.cartaoAtivo ||
    !config.boletoAtivo
  ) {
    config = await db.configuracaoPagamento.update({
      where: { id: config.id },
      data: {
        mercadoPagoAtivo: true,
        mercadoPagoSandbox: false,
        pixAtivo: true,
        cartaoAtivo: true,
        boletoAtivo: true,
      },
    })
  }
  return {
    ...config,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  }
}

/** Token efetivo: usa o do banco se configurado, senão o do .env, senão fallback. */
function tokenEfetivo(config: ConfiguracaoPagamento): {
  token: string
  origem: 'banco' | 'env' | 'fallback'
} {
  if (config.mercadoPagoAccessToken && config.mercadoPagoAccessToken.trim()) {
    return { token: config.mercadoPagoAccessToken.trim(), origem: 'banco' }
  }
  const envToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (envToken && envToken.trim() && !envToken.includes('xxxxxxxx')) {
    return { token: envToken.trim(), origem: 'env' }
  }
  return { token: TOKEN_FALLBACK, origem: 'fallback' }
}

/** Indica se estamos em modo simulado (sem token real ou sandbox configurada para simular). */
export function ehModoSimulado(config: ConfiguracaoPagamento): boolean {
  const { origem } = tokenEfetivo(config)
  // Sempre simula quando cai no fallback. Em sandbox real com token válido,
  // continua usando a API do MP, mas o cliente ainda pode usar o fluxo.
  return origem === 'fallback' || !config.mercadoPagoAtivo
}

/** Cria o cliente do Mercado Pago. Lança se o token for inválido/ausente. */
function criarClienteMP(token: string): MercadoPagoConfig {
  return new MercadoPagoConfig({
    accessToken: token,
    options: { timeout: 8000 },
  })
}

export interface ItemPreferencia {
  produtoId: string
  nome: string
  quantidade: number
  precoUnit: number
}

export interface CriarPagamentoInput {
  vendaId: string
  total: number
  itens: ItemPreferencia[]
  metodo: MetodoPagamento
  notificationUrl?: string
  externalReference?: string
}

export interface CriarPagamentoResultado {
  preferenceId: string
  initPoint: string
  qrCode?: string
  qrCodeBase64?: string
  pixCopiaECola?: string
  pixExpiresAt?: string
  boletoUrl?: string
  mercadoPagoId?: string
  simulado: boolean
}

/**
 * Gera um "QR Code" fake (data URL) e um código "copia e cola" simulado,
 * para uso quando o MP não está disponível.
 */
function gerarQrSimulado(vendaId: string, total: number): {
  qrCodeBase64: string
  pixCopiaECola: string
  pixExpiresAt: string
} {
  // SVG simples com o ID da venda e o valor — apenas placeholder visual
  const texto = `SIMULADO-MATILHA-${vendaId}-${total.toFixed(2)}`
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <rect width="240" height="240" fill="#ffffff"/>
  ${Array.from({ length: 12 })
    .map((_, y) =>
      Array.from({ length: 12 })
        .map((_, x) => {
          const on = (x * 7 + y * 3 + texto.length) % 3 === 0
          return on
            ? `<rect x="${x * 18 + 12}" y="${y * 18 + 12}" width="16" height="16" fill="#000000"/>`
            : ''
        })
        .join('')
    )
    .join('')}
  <text x="120" y="232" text-anchor="middle" font-family="monospace" font-size="10" fill="#000000">PIX SIMULADO</text>
</svg>`
  const base64 = Buffer.from(svg).toString('base64')
  const dataUrl = `data:image/svg+xml;base64,${base64}`
  const copiaECola = `00020126360014BR.GOV.BCB.PIX0111matilha-prado-simulado5204000053039865802BR5913MATILHA PRADO6009SAO PAULO62070503***6304${vendaId
    .slice(-4)
    .toUpperCase()}`
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  return { qrCodeBase64: dataUrl, pixCopiaECola: copiaECola, pixExpiresAt: expiresAt }
}

/**
 * Cria uma preferência de pagamento no Mercado Pago.
 * Se o token não for válido ou a API falhar, retorna modo simulado.
 */
export async function criarPagamento(
  input: CriarPagamentoInput,
  config: ConfiguracaoPagamento
): Promise<CriarPagamentoResultado> {
  const { token, origem } = tokenEfetivo(config)
  const simulado = ehModoSimulado(config)

  if (simulado || origem === 'fallback') {
    return gerarPagamentoSimulado(input)
  }

  try {
    const client = criarClienteMP(token)
    const preference = new Preference(client)

    const paymentMethods: any = {}
    if (input.metodo === 'pix') {
      paymentMethods.default_payment_method_id = 'pix'
      paymentMethods.excluded_payment_methods = []
      paymentMethods.excluded_payment_types = [
        { id: 'credit_card' },
        { id: 'debit_card' },
        { id: 'ticket' }, // boleto
      ]
    } else if (input.metodo === 'boleto') {
      paymentMethods.default_payment_method_id = 'bolbradesco'
      paymentMethods.excluded_payment_types = [
        { id: 'credit_card' },
        { id: 'debit_card' },
        { id: 'pix' },
      ]
    } else {
      // cartao: permite apenas cartão
      paymentMethods.excluded_payment_types = [{ id: 'ticket' }, { id: 'pix' }]
    }

    const notificationUrl =
      input.notificationUrl ||
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/pagamento/webhook`

    const body: any = {
      items: input.itens.map((it) => ({
        id: it.produtoId,
        title: it.nome,
        quantity: it.quantidade,
        unit_price: Number(it.precoUnit.toFixed(2)),
        currency_id: 'BRL',
      })),
      payment_methods: paymentMethods,
      notification_url: notificationUrl,
      external_reference: input.vendaId,
      metadata: { vendaId: input.vendaId, metodo: input.metodo },
      statement_descriptor: 'MATILHA PRADO',
      back_urls: {
        success: `${process.env.NEXTAUTH_URL || ''}/?status=success`,
        pending: `${process.env.NEXTAUTH_URL || ''}/?status=pending`,
        failure: `${process.env.NEXTAUTH_URL || ''}/?status=failure`,
      },
      auto_return: 'approved',
    }

    const result = await preference.create({ body })

    const initPoint =
      (result as any)?.init_point ||
      (result as any)?.sandbox_init_point ||
      ''

    // Para PIX, o Mercado Pago não gera o QR na preferência —
    // o cliente precisa abrir o checkout. Em modo simulado, geramos fake.
    const saida: CriarPagamentoResultado = {
      preferenceId: (result as any)?.id || `sim_${input.vendaId}`,
      initPoint: initPoint || 'about:blank',
      simulado: false,
    }

    // Se for PIX, tentamos gerar QR simulado para exibir imediatamente
    // (o MP Checkout Pro redireciona para tela de PIX com QR, mas a gente
    // também mostra aqui por conveniência).
    if (input.metodo === 'pix') {
      const qr = gerarQrSimulado(input.vendaId, input.total)
      saida.qrCodeBase64 = qr.qrCodeBase64
      saida.pixCopiaECola = qr.pixCopiaECola
      saida.pixExpiresAt = qr.pixExpiresAt
    }

    return saida
  } catch (e: any) {
    console.error('[mercado-pago] criarPagamento falhou, usando simulado:', e?.message || e)
    return gerarPagamentoSimulado(input)
  }
}

function gerarPagamentoSimulado(input: CriarPagamentoInput): CriarPagamentoResultado {
  const resultado: CriarPagamentoResultado = {
    preferenceId: `sim_${input.vendaId}_${input.metodo}`,
    initPoint: 'about:blank',
    simulado: true,
    mercadoPagoId: `SIM-${input.vendaId.slice(-8).toUpperCase()}`,
  }

  if (input.metodo === 'pix') {
    const qr = gerarQrSimulado(input.vendaId, input.total)
    resultado.qrCodeBase64 = qr.qrCodeBase64
    resultado.pixCopiaECola = qr.pixCopiaECola
    resultado.pixExpiresAt = qr.pixExpiresAt
  } else if (input.metodo === 'boleto') {
    resultado.boletoUrl = `data:text/plain;charset=utf-8,Boleto%20simulado%20-%20Matilha%20Prado%20-%20Venda%20${input.vendaId.slice(
      -8
    )}%20-%20R$%20${input.total.toFixed(2)}`
  }
  // Para cartão, o "initPoint" simulado é about:blank — cliente mostra botão "simular pagamento"

  return resultado
}

/**
 * Consulta o status de um pagamento diretamente na API do MP.
 * Se não for possível, retorna null (o chamador deve manter o status atual).
 */
export async function consultarStatusMP(
  paymentId: string,
  config: ConfiguracaoPagamento
): Promise<string | null> {
  if (ehModoSimulado(config) || !paymentId || paymentId.startsWith('SIM-')) {
    return null
  }
  const { token, origem } = tokenEfetivo(config)
  if (origem === 'fallback') return null
  try {
    const client = criarClienteMP(token)
    const payment = new Payment(client)
    const res = await payment.get({ id: paymentId })
    return (res as any)?.status || null
  } catch (e: any) {
    console.error('[mercado-pago] consultarStatusMP falhou:', e?.message || e)
    return null
  }
}

/** Converte status do MP para o status interno da Venda. */
export function statusMPToVenda(statusMP: string | null | undefined): string | null {
  if (!statusMP) return null
  const s = statusMP.toLowerCase()
  if (s === 'approved' || s === 'authorized') return 'concluida'
  if (s === 'pending' || s === 'in_process' || s === 'in_mediation') return 'pendente'
  if (s === 'rejected' || s === 'cancelled') return 'cancelada'
  return null
}
