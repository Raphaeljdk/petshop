/**
 * Preparação NÃO OPERACIONAL do split da Freitas Corp.
 *
 * O checkout atual usa Mercado Pago Orders API, que não disponibiliza
 * application_fee na integração documentada. Este módulo não cria cobranças,
 * não altera o recebedor e não transfere valores.
 */
export const FREITAS_CORP_FEE_CENTS = 200

export type SplitGateway = 'orders_api' | 'payments_api' | 'checkout_pro'
export type SplitDecision =
  | { eligible: false; reason: 'disabled' | 'unsupported_gateway' | 'invalid_total' | 'fee_exceeds_total' }
  | { eligible: true; feeCents: number; merchantGrossCents: number }

/**
 * Apenas para planejamento e testes.
 * A aprovação comercial e OAuth não são substituídos por uma flag.
 * Nunca usar este retorno para lançar comissão em um pagamento já processado.
 */
export function evaluateFreitasCorpSplit(input: {
  enabled: boolean
  sellerAuthorized: boolean
  gateway: SplitGateway
  totalCents: number
}): SplitDecision {
  if (!input.enabled || !input.sellerAuthorized) return { eligible: false, reason: 'disabled' }
  if (input.gateway === 'orders_api') return { eligible: false, reason: 'unsupported_gateway' }
  if (!Number.isSafeInteger(input.totalCents) || input.totalCents <= 0)
    return { eligible: false, reason: 'invalid_total' }
  if (input.totalCents <= FREITAS_CORP_FEE_CENTS)
    return { eligible: false, reason: 'fee_exceeds_total' }

  return {
    eligible: true,
    feeCents: FREITAS_CORP_FEE_CENTS,
    merchantGrossCents: input.totalCents - FREITAS_CORP_FEE_CENTS,
  }
}
