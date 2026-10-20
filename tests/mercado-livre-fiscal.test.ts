import { describe, test, expect } from 'bun:test'
import { onlyOrderId, parseMeliInvoice, snapshot, allowedMeliDocumentPath, MercadoLivreFiscalError } from '../src/lib/mercado-livre-fiscal'

const invoice = (overrides: Record<string, unknown> = {}) => ({
  id: 12345678,
  status: 'authorized',
  transaction_status: 'authorized',
  invoice_number: 123,
  invoice_series: 1,
  attributes: {
    invoice_key: '3'.repeat(44),
    protocol: '123456789',
    authorization_date: '2026-10-20T17:30:00.000Z',
    xml_location: '/users/123456789/invoices/documents/xml/12345678/authorized',
    danfe_location: '/users/123456789/invoices/sites/MLB/documents/danfe/12345678',
  },
  fiscal_data: { transaction_type: 'sale' },
  ...overrides,
})
describe('Conciliação de NF-e Mercado Livre', () => {
  test('reconhece NF-e autorizada somente com número, chave de 44 dígitos e protocolo', () => {
    const snap = snapshot(invoice())
    expect(snap.status).toBe('autorizada')
    expect(snap.numero).toBe(123)
    expect(snap.chaveAcesso).toHaveLength(44)
    expect(snap.autorizadaEm).toBeInstanceOf(Date)
  })
  test('não autoriza nota incompleta nem inventa XML válido', () => {
    const s = snapshot(invoice({ attributes: { invoice_key: '123', protocol: null } }))
    expect(s.status).toBe('pendente_conferencia')
    expect(s.chaveAcesso).toBeNull()
    expect(s.autorizadaEm).toBeNull()
  })
  test('nota cancelada não pode ser tratada como autorizada', () => {
    expect(snapshot(invoice({ status:'canceled', transaction_status:'canceled' })).status).toBe('cancelada')
  })
  test('reconhece resposta vazia e rejeita mais de uma nota de venda', () => {
    expect(parseMeliInvoice([])).toBeNull()
    expect(parseMeliInvoice({results:[invoice()]} )?.id).toBe(12345678)
    expect(()=>parseMeliInvoice([invoice(), invoice({id:12345679})])).toThrow()
  })
  test('rejeita documentos fiscais de outra natureza sem tentar nova emissão', () => {
    expect(()=>parseMeliInvoice([invoice({fiscal_data:{transaction_type:'inbound'}})])).toThrow()
  })
  test('IDs de pedidos devem ser numéricos e precisos', () => {
    expect(onlyOrderId('200000123456789')).toBe('200000123456789')
    expect(()=>onlyOrderId('200000123456789;DROP')).toThrow()
    expect(()=>onlyOrderId('99999999999999999999')).toThrow(MercadoLivreFiscalError)
  })
  test('downloads ficam restritos ao vendedor correto e host oficial', () => {
    const okay='/users/123456789/invoices/documents/xml/12345678/authorized'
    expect(allowedMeliDocumentPath(okay, '123456789', 'xml')).toBe(okay)
    expect(allowedMeliDocumentPath(okay, '456', 'xml')).toBeNull()
    expect(allowedMeliDocumentPath('https://malicious.com/a', '123456789', 'xml')).toBeNull()
    expect(allowedMeliDocumentPath('/users/123456789/invoices/documents/xml/../../x', '123456789', 'xml')).toBeNull()
  })
})
