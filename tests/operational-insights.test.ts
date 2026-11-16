import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcularMargem, diagnosticarCatalogo, identificarChoquesAgenda, orientarErroFiscal, type ProdutoOperacional } from '../src/lib/operational-insights'

function produto(id: string, extras: Partial<ProdutoOperacional> = {}): ProdutoOperacional {
  return {
    id, nome: 'KONG Puppy Rosa', descricao: null, categoria: 'Brinquedos',
    sku: 'ABC123', imageUrl: null, preco: 79.9, estoque: 3,
    estoqueHub: 3, estoqueZetta: 2, estoqueMercadoLivre: 2, estoqueAmazon: 2,
    estoqueIlimitado: false, zettaProCod: 123, mlItemId: null, amazonAsin: null,
    ativo: true, ...extras,
  }
}

test('diagnóstico não mistura produtos inativos nem exclui anúncios por SKU', () => {
  const rows = [
    produto('z', { imageUrl: 'https://example.com/kong.jpg' }),
    produto('ml', { zettaProCod: null, mlItemId: 'MLB100', nome: 'KONG Puppy Rosa', estoqueMercadoLivre: 5 }),
    produto('cor', { zettaProCod: null, mlItemId: 'MLB200', nome: 'KONG Puppy Azul' }),
    produto('inativo', { ativo: false }),
  ]
  const original = structuredClone(rows)
  const diag = diagnosticarCatalogo(rows)
  assert.equal(diag.total, 3)
  assert.equal(diag.semFoto, 2)
  assert.equal(diag.gruposRelacionados, 1)
  assert.equal(diag.saldosDiferentes, 0) // Cada anúncio só possui uma fonte vinculada.
  assert.deepEqual(rows, original)
})

test('saldos diferentes são alerta para conferir, não ajuste automático', () => {
  const p = produto('1', { mlItemId: 'MLB101', estoqueZetta: 6, estoqueMercadoLivre: 2 })
  const diag = diagnosticarCatalogo([p])
  assert.equal(diag.saldosDiferentes, 1)
  assert.deepEqual(diag.exemplosDivergencias[0].saldos, [
    { canal: 'Zetta', saldo: 6 }, { canal: 'Mercado Livre', saldo: 2 },
  ])
  assert.equal(p.estoqueMercadoLivre, 2)
})

test('a agenda sinaliza mesmo profissional no mesmo instante e ignora cancelados', () => {
  const hora = new Date('2026-11-18T13:00:00Z')
  const agenda = [
    { id: 'a', dataHora: hora, profissionalId: 'pro1', status: 'agendado', pet: { nome: 'Mel' } },
    { id: 'b', dataHora: hora, profissionalId: 'pro1', status: 'confirmado', pet: { nome: 'Thor' } },
    { id: 'c', dataHora: hora, profissionalId: 'pro2', status: 'agendado', pet: { nome: 'Luna' } },
    { id: 'd', dataHora: hora, profissionalId: 'pro1', status: 'cancelado', pet: { nome: 'Nina' } },
  ]
  const choques = identificarChoquesAgenda(agenda)
  assert.equal(choques.length, 1)
  assert.deepEqual(choques[0].pets, ['Mel', 'Thor'])
})

test('margem só é calculada com dados completos, explícitos e válidos', () => {
  assert.equal(calcularMargem(null), null)
  assert.equal(calcularMargem({ receita: 100, custoProdutos: -1, taxasMarketplace: 0, freteOperacao: 0, impostos: 0, outrosCustos: 0 }), null)
  assert.deepEqual(calcularMargem({
    receita: 100, custoProdutos: 40, taxasMarketplace: 12, freteOperacao: 5, impostos: 6, outrosCustos: 2,
  }), { lucro: 35, margemPercentual: 35 })
  assert.deepEqual(calcularMargem({
    receita: 0, custoProdutos: 0, taxasMarketplace: 0, freteOperacao: 0, impostos: 0, outrosCustos: 0,
  }), { lucro: 0, margemPercentual: null })
})


test('orientação fiscal não autoriza retransmissão nem altera tributação', () => {
  assert.match(orientarErroFiscal('Rejeição: Duplicidade de NF-e (539)'), /Consultar a chave/)
  assert.match(orientarErroFiscal('Erro CST PIS/COFINS'), /contabilidade/)
  assert.match(orientarErroFiscal('Falha XSD schema'), /pacote XSD oficial/)
})
