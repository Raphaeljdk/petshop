import { describe, expect, test } from 'bun:test'
import { evaluateFreitasCorpSplit, FREITAS_CORP_FEE_CENTS } from '../src/lib/freitas-corp-split'

describe('Freitas Corp split — preparação sem efeito em produção', () => {
  test('comissão fixa é R$ 2,00', () => {
    expect(FREITAS_CORP_FEE_CENTS).toBe(200)
  })
  test('Orders API atual nunca habilita o split', () => {
    expect(evaluateFreitasCorpSplit({
      enabled: true, sellerAuthorized: true, gateway: 'orders_api', totalCents: 10000,
    })).toEqual({ eligible: false, reason: 'unsupported_gateway' })
  })
  test('sem consentimento não aplica comissão', () => {
    expect(evaluateFreitasCorpSplit({
      enabled: true, sellerAuthorized: false, gateway: 'payments_api', totalCents: 10000,
    })).toEqual({ eligible: false, reason: 'disabled' })
  })
  test('disabled por padrão, sem cobranças', () => {
    expect(evaluateFreitasCorpSplit({
      enabled: false, sellerAuthorized: true, gateway: 'payments_api', totalCents: 10000,
    })).toEqual({ eligible: false, reason: 'disabled' })
  })
  test('Payments API autorizada calcula em centavos', () => {
    expect(evaluateFreitasCorpSplit({
      enabled: true, sellerAuthorized: true, gateway: 'payments_api', totalCents: 10000,
    })).toEqual({ eligible: true, feeCents: 200, merchantGrossCents: 9800 })
  })
  test('não admite valor inválido nem venda menor/igual à comissão', () => {
    expect(evaluateFreitasCorpSplit({
      enabled: true, sellerAuthorized: true, gateway: 'payments_api', totalCents: NaN,
    })).toEqual({ eligible: false, reason: 'invalid_total' })
    expect(evaluateFreitasCorpSplit({
      enabled: true, sellerAuthorized: true, gateway: 'checkout_pro', totalCents: 200,
    })).toEqual({ eligible: false, reason: 'fee_exceeds_total' })
  })
})
