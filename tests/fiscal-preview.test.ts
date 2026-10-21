import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gerarPreviaXml, xmlText, type PreviewSale } from '../src/lib/fiscal-preview'

const sale = (): PreviewSale => ({
  id: 'teste-unitario', canal: 'site', status: 'concluida', total: 29.97,
  createdAt: new Date('2026-10-21T12:00:00Z'), valorFrete: 5, descontoCupom: 5,
  subtotalProdutos: 29.97, marketplaceBuyerName: null, marketplaceBuyerDocument: null,
  enderecoEntrega: null, cepEntrega: null, cliente: null,
  itens: [{ produtoId: 'produto', quantidade: 3, precoUnit: 9.99, produto: {
    nome: 'Produto & <teste>', sku: null, ncm: null, cest: null, cfop: null,
    origem: '0', cst: null, csosn: null, unidadeFiscal: 'UN',
  } }],
})
test('prévia não cria identificadores fiscais nem presume dados ausentes', () => {
  const result = gerarPreviaXml(sale(), null)
  assert.match(result.xml, /validadeFiscal="false" assinada="false" transmitida="false"/)
  assert.match(result.xml, /<totalCalculado>29.97<\/totalCalculado>/)
  assert.match(result.xml, /Produto &amp; &lt;teste&gt;/)
  assert.match(result.xml, /<ncm><\/ncm>/)
  assert.ok(result.pendencias.some(p => p.includes('NCM') || p.includes('ncm')))
  assert.doesNotMatch(result.xml, /<NFe\b|<Signature\b|<protNFe\b|<chNFe\b/)
})
test('total divergente é informado, sem corrigir o valor da venda', () => {
  const s = sale(); s.total = 30
  const result = gerarPreviaXml(s, null)
  assert.match(result.xml, /<totalRegistrado>30.00<\/totalRegistrado>/)
  assert.ok(result.pendencias.some(p => p.includes('Total divergente')))
})
test('bloqueia cancelamento, canal presencial e valores inválidos', () => {
  for (const patch of [{status:'cancelada'}, {canal:'loja'}, {total:NaN}, {valorFrete:-1}, {descontoCupom:Infinity}])
    assert.throws(() => gerarPreviaXml({...sale(),...patch}, null))
  const s = sale(); s.itens[0].quantidade = 0
  assert.throws(() => gerarPreviaXml(s, null))
})
test('escapa injeção XML e remove caracteres inválidos preservando Unicode', () => {
  assert.equal(xmlText('<!DOCTYPE a>&"\'\u0000\uD800🐕'), '&lt;!DOCTYPE a&gt;&amp;&quot;&apos;🐕')
  const result = gerarPreviaXml(sale(), {razaoSocial:'<x>&', cnpj:null})
  assert.match(result.xml, /<razaoSocial>&lt;x&gt;&amp;<\/razaoSocial>/)
})
test('não modifica os dados originais nem calcula tributação ausente', () => {
  const s = sale(); const before = structuredClone(s)
  gerarPreviaXml(s, null)
  assert.deepEqual(s,before)
})
