/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { NextRequest } = require('next/server')

function harness() {
  const state = { user: null, db: {}, now: new Date('2026-10-22T20:00:00Z') }
  const cache = new Map()
  function load(relative) {
    const filename = path.resolve(__dirname, '..', relative)
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    function localRequire(id) {
      if (id === '@/lib/db') return { db: state.db }
      if (id === '@/lib/auth-cookies') return { getUsuarioLogado: async () => state.user }
      if (id.startsWith('@/')) return load('src/' + id.slice(2) + '.ts')
      return require(id)
    }
    class Clock extends Date {
      constructor(...args) { super(...(args.length ? args : [state.now])) }
      static now() { return state.now.getTime() }
    }
    vm.runInThisContext('(function(require,module,exports,Date){' + code + '\n})', { filename })(localRequire, module, module.exports, Clock)
    return module.exports
  }
  return { state, load, request: (days = '7') => new NextRequest('https://example.test/api/dashboard/comercial?dias=' + days) }
}

function matches(row, where = {}) {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') return condition.some(part => matches(row, part))
    const value = row[key]
    if (condition === null || typeof condition !== 'object') return value === condition
    if ('gte' in condition && !(value !== null && value >= condition.gte)) return false
    if ('lte' in condition && !(value !== null && value <= condition.lte)) return false
    if ('not' in condition && value === condition.not) return false
    if ('in' in condition && !condition.in.includes(value)) return false
    return Object.keys(condition).some(k => ['gte', 'lte', 'not', 'in'].includes(k)) || matches(value, condition)
  })
}

function database(h, { sales = [], invoices = [], products = [], clients = [], pets = [], items = [] } = {}) {
  const sum = rows => ({ _sum: { total: rows.reduce((s, r) => s + r.total, 0) }, _count: { id: rows.length } })
  const filter = (rows, args) => rows.filter(row => matches(row, args.where))
  h.state.db = {
    venda: {
      aggregate: async args => sum(filter(sales, args)),
      findMany: async args => filter(sales, args),
      groupBy: async args => {
        const key = args.by[0], groups = new Map()
        for (const row of filter(sales, args)) groups.set(row[key], [...(groups.get(row[key]) || []), row])
        let rows = [...groups].map(([value, values]) => ({ [key]: value, ...sum(values) }))
        if (args.orderBy) rows.sort((a, b) => b._sum.total - a._sum.total || a[key].localeCompare(b[key]))
        return args.take ? rows.slice(0, args.take) : rows
      },
    },
    notaFiscal: {
      findMany: async args => filter(invoices, args),
      count: async args => filter(invoices, args).length,
    },
    itemVenda: { groupBy: async args => {
      const groups = new Map()
      for (const item of filter(items, args)) groups.set(item.produtoId, (groups.get(item.produtoId) || 0) + item.quantidade)
      return [...groups].map(([produtoId, quantidade]) => ({ produtoId, _sum: { quantidade } }))
        .sort((a, b) => b._sum.quantidade - a._sum.quantidade || a.produtoId.localeCompare(b.produtoId)).slice(0, args.take)
    } },
    produto: { findMany: async args => filter(products, args) },
    cliente: { findMany: async args => filter(clients, args) },
    pet: { findMany: async args => filter(pets, args) },
  }
  h.state.user = { role: 'ADMIN' }
}
const sale = (id, overrides = {}) => ({ id, status: 'concluida', total: 100, canal: 'loja', clienteId: 'c1',
  mercadoPagoId: null, mercadoPagoStatus: null, createdAt: new Date('2026-10-22T15:00:00Z'), ...overrides })
const invoice = (id, venda, overrides = {}) => ({ id, modelo: '55', status: 'autorizada', canceladaEm: null,
  autorizadaEm: new Date('2026-10-22T15:00:00Z'), venda, ...overrides })
const pet = (id, nascimento, overrides = {}) => ({ id, nome: id, nascimento: nascimento ? new Date(nascimento) : null,
  ativo: true, cliente: { nome: 'Tutor', ativo: true }, ...overrides })

test('API bloqueia anônimos, clientes e operadores antes de consultar os dados comerciais', async () => {
  const h = harness(), route = h.load('src/app/api/dashboard/comercial/route.ts')
  assert.equal((await route.GET(h.request())).status, 401)
  for (const role of ['CLIENTE', 'KANBAN']) {
    h.state.user = { role }
    assert.equal((await route.GET(h.request())).status, 403)
  }
})

test('API rejeita período fora das opções antes de consultar o banco', async () => {
  const h = harness()
  h.state.user = { role: 'ADMIN' }
  const route = h.load('src/app/api/dashboard/comercial/route.ts')
  for (const value of ['-1', '0', '8', '365', '7.5', 'NaN']) assert.equal((await route.GET(h.request(value))).status, 400)
})

for (const days of [7, 30, 90]) test(`período de ${days} dias inclui exatamente ${days} datas e começa à meia-noite de São Paulo`, () => {
  const { periodoComercial } = harness().load('src/lib/dashboard-comercial.ts')
  const period = periodoComercial(days, new Date('2026-01-02T01:30:00Z')) // Ainda 01/01 em SP.
  assert.equal(period.datas.length, days)
  assert.equal(new Set(period.datas).size, days)
  assert.equal(period.datas.at(-1), '2026-01-01')
  assert.equal(period.inicio.toISOString(), period.datas[0] + 'T03:00:00.000Z')
  assert.equal(period.fim.toISOString(), '2026-01-02T01:30:00.000Z')
})

test('aniversários incluem hoje, virada do ano e o 30º dia; excluem futuro e não cortam após 12 pets', () => {
  const { proximosAniversarios } = harness().load('src/lib/dashboard-comercial.ts')
  const pets = Array.from({ length: 14 }, (_, i) => pet('Pet ' + i, '2020-12-20'))
  pets.push(pet('Ano novo', '2022-01-01'), pet('Limite', '2022-01-19'), pet('Depois', '2022-01-20'), pet('Futuro', '2026-12-21'), pet('Sem data', null))
  const result = proximosAniversarios(pets, new Date('2026-12-20T14:00:00Z'))
  assert.equal(result.length, 16)
  assert.equal(result[0].dias, 0)
  assert.equal(result.find(x => x.id === 'Ano novo').idade, 5)
  assert.equal(result.at(-1).dias, 30)
  assert.equal(result.at(-1).tutor, 'Tutor')
})

test('aniversário em 29/02 usa 28/02 no ano comum e 29/02 no bissexto', () => {
  const { proximosAniversarios } = harness().load('src/lib/dashboard-comercial.ts')
  const pets = [pet('Mel', '2020-02-29')]
  assert.equal(proximosAniversarios(pets, new Date('2027-02-28T12:00:00Z'))[0].data, '2027-02-28')
  assert.equal(proximosAniversarios(pets, new Date('2028-02-28T12:00:00Z'))[0].data, '2028-02-29')
})

test('vendas e NF-e têm totais independentes por canal, status e data, sem dupla contagem', async () => {
  const h = harness()
  const ml = sale('ml', { canal: 'mercado_livre', total: 90.1 })
  const meli = sale('meli', { canal: 'MELI', total: 10.2 })
  const amazon = sale('amz', { canal: 'amazon', total: 50, clienteId: null })
  const online = sale('site', { canal: 'site', total: 49.7, mercadoPagoId: 'payment', mercadoPagoStatus: 'approved' })
  const early = sale('early', { total: 30, createdAt: new Date('2026-10-16T03:00:00Z') })
  const before = sale('before', { total: 500, createdAt: new Date('2026-10-16T02:59:59Z') })
  const canceled = sale('cancel', { status: 'cancelada', total: 500 })
  const refunded = sale('refund', { mercadoPagoStatus: 'refunded', total: 500 })
  const pending = sale('pending', { status: 'pendente', total: 500 })
  const old = sale('old', { canal: 'amazon', total: 80, createdAt: new Date('2026-09-01') })
  database(h, { sales: [ml, meli, amazon, online, early, before, canceled, refunded, pending, old],
    invoices: [invoice('n1', ml), invoice('n2', old), invoice('n3', pending),
      invoice('cancelled', canceled, { status: 'cancelada' }),
      invoice('cancelDate', ml, { canceladaEm: new Date() }),
      invoice('draft', ml, { status: 'rascunho' }), invoice('nfce', ml, { modelo: '65' }),
      invoice('oldDate', ml, { autorizadaEm: new Date('2026-10-16T02:59:59Z') }),
      invoice('noDate', ml, { autorizadaEm: null })],
    clients: [{ id: 'c1', nome: 'Cliente cadastrado' }],
  })
  const response = await h.load('src/app/api/dashboard/comercial/route.ts').GET(h.request())
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const result = await response.json()
  assert.deepEqual(result.indicadores, { vendido: 230, pedidos: 5, ticketMedio: 46, faturadoNfe: 670.1, notasAutorizadas: 3, notasAutorizadasSemData: 1 })
  assert.equal(result.canais.find(x => x.id === 'mercadolivre').vendido, 100.3)
  assert.equal(result.canais.find(x => x.id === 'amazon').faturadoNfe, 80)
  assert.equal(result.evolucao.length, 7)
  assert.equal(result.evolucao[0].vendido, 30)
  assert.equal(result.evolucao.at(-1).vendido, 200)
  assert.equal(result.evolucao.at(-1).faturadoNfe, 670.1)
  assert.equal(result.melhoresClientes[0].compras, 4)
  assert.equal(result.melhoresClientes[0].total, 180)
})

test('rankings retornam os 8 líderes por quantidade e gasto; pets inativos ficam de fora', async () => {
  const h = harness()
  const products = Array.from({ length: 10 }, (_, i) => ({ id: 'p' + i, nome: 'Produto ' + i }))
  const clients = Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i, nome: 'Cliente ' + i }))
  const sales = clients.map((c, i) => sale('s' + i, { clienteId: c.id, total: (i + 1) * 10 }))
  database(h, { products, clients, sales,
    items: products.map((p, i) => ({ produtoId: p.id, quantidade: i + 1, venda: sales[i] })),
    pets: [pet('Ativo', '2020-10-22'), pet('Inativo', '2020-10-22', { ativo: false }), pet('Tutor inativo', '2020-10-22', { cliente: { nome: 'Inativo', ativo: false } })],
  })
  const result = await (await h.load('src/app/api/dashboard/comercial/route.ts').GET(h.request())).json()
  assert.equal(result.maisVendidos.length, 8)
  assert.deepEqual(result.maisVendidos[0], { id: 'p9', nome: 'Produto 9', quantidade: 10 })
  assert.equal(result.melhoresClientes.length, 8)
  assert.deepEqual(result.melhoresClientes[0], { id: 'c9', nome: 'Cliente 9', total: 100, compras: 1 })
  assert.equal(result.aniversarios.length, 1)
  assert.equal(result.aniversarios[0].nome, 'Ativo')
})

test('sem registros retorna zeros, séries completas e listas vazias, sem dados inventados', async () => {
  const h = harness()
  database(h)
  const result = await (await h.load('src/app/api/dashboard/comercial/route.ts').GET(h.request('30'))).json()
  assert.equal(result.indicadores.pedidos, 0)
  assert.equal(result.indicadores.ticketMedio, 0)
  assert.equal(result.evolucao.length, 30)
  assert.ok(result.evolucao.every(x => x.vendido === 0 && x.faturadoNfe === 0))
  assert.deepEqual(result.maisVendidos, [])
  assert.deepEqual(result.melhoresClientes, [])
  assert.deepEqual(result.aniversarios, [])
})

test('visão geral usa o mesmo critério de pagamento e exclui notas canceladas', async () => {
  const h = harness()
  const approved = sale('ok', { mercadoPagoStatus: 'approved' })
  database(h, { sales: [approved, sale('refunded', { mercadoPagoStatus: 'refunded' })],
    invoices: [invoice('ok', approved), invoice('cancelled', approved, { canceladaEm: new Date() }), invoice('nfce', approved, { modelo: '65' })],
  })
  h.state.db.venda.count = async () => 0
  for (const model of ['cliente', 'pet', 'produto', 'processo', 'agendamento', 'user']) {
    h.state.db[model] = { ...h.state.db[model], count: async () => 0, findMany: async () => [] }
  }
  const result = await (await h.load('src/app/api/dashboard/route.ts').GET()).json()
  assert.equal(result.receitaMes, 100)
  assert.equal(result.vendasMes, 1)
  assert.equal(result.notasEmitidas, 1)
})
