/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { NextRequest } = require('next/server')
const root = path.resolve(__dirname, '..')

function harness() {
  const state = { client: null, admin: false, user: null, db: {}, official: {} }
  const cache = new Map()
  function load(relative) {
    const filename = path.join(root, relative)
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText
    const localRequire = (id) => {
      if (id === '@/lib/realtime') return { emitWebSocket: async () => {} }
      if (id === '@/lib/db') return { db: state.db }
      if (id === '@/lib/auth-helpers' || id === '@/lib/auth-cookies')
        return {
          getClienteLogado: async () => state.client,
          getUsuarioLogado: async () => state.user,
          isAdmin: async () => state.admin,
          assertAuthConfigured() {},
        }
      if (id === '@/lib/zetta-products')
        return {
          getZettaProduct: async () => state.official,
          zettaProductPrice: (p) => p.preco,
          zettaProductStock: (p) => p.estoque,
        }
      if (id === '@/lib/zetta-client')
        return { getZettaAnimalsByClient: async () => state.animals || [] }
      if (id.startsWith('@/')) return load('src/' + id.slice(2) + '.ts')
      return require(id)
    }
    vm.runInThisContext('(function(require,module,exports){' + code + '\n})', {
      filename,
    })(localRequire, module, module.exports)
    return module.exports
  }
  const request = (url, method = 'POST', body, extra = {}) =>
    new NextRequest('https://matilhaprado.com.br' + url, {
      method,
      headers: {
        'content-type': 'application/json',
        origin: 'https://matilhaprado.com.br',
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  return { state, load, request }
}

test('customer mutations deny anonymous access before touching data', async () => {
  const h = harness()
  for (const [file, method] of [
    ['preferencias', 'PUT'],
    ['avaliacoes', 'POST'],
    ['perfil-pet', 'PUT'],
    ['fidelidade', 'POST'],
    ['solicitacoes-agendamento', 'POST'],
  ]) {
    const route = h.load(`src/app/api/cliente/${file}/route.ts`)
    const result = await route[method](
      h.request('/api/cliente/' + file, method, {}),
    )
    assert.equal(result.status, 401, file)
  }
  const admin = h.load('src/app/api/admin/relacionamento/route.ts')
  assert.equal((await admin.GET()).status, 403)
  assert.equal(
    (
      await admin.POST(
        h.request('/api/admin/relacionamento', 'POST', { action: 'config' }),
      )
    ).status,
    403,
  )
})

test('cross-site writes, forged client ids and invalid reminder dates are rejected', async () => {
  const h = harness()
  h.state.client = { id: 'alice' }
  const route = h.load('src/app/api/cliente/preferencias/route.ts')
  assert.equal(
    (
      await route.PUT(
        h.request(
          '/api/cliente/preferencias',
          'PUT',
          { produtoId: 'p', favorite: true },
          { origin: 'https://evil.invalid' },
        ),
      )
    ).status,
    403,
  )
  assert.equal(
    (
      await route.PUT(
        h.request('/api/cliente/preferencias', 'PUT', {
          produtoId: 'p',
          favorite: true,
          clienteId: 'bob',
        }),
      )
    ).status,
    400,
  )
  assert.equal(
    (
      await route.PUT(
        h.request('/api/cliente/preferencias', 'PUT', {
          produtoId: 'p',
          reminderAt: '2020-01-01T00:00:00.000Z',
        }),
      )
    ).status,
    400,
  )
})

test('reviews require a completed paid purchase owned by the signed-in client', async () => {
  const h = harness()
  h.state.client = { id: 'alice' }
  let lookup
  let saved
  h.state.db.venda = {
    findFirst: async (args) => {
      lookup = args
      return null
    },
  }
  h.state.db.productReview = {
    upsert: async (args) => {
      saved = args
      return args.create
    },
  }
  const route = h.load('src/app/api/cliente/avaliacoes/route.ts')
  const body = { produtoId: 'p', rating: 5, comment: 'Produto bom' }
  assert.equal(
    (await route.POST(h.request('/api/cliente/avaliacoes', 'POST', body)))
      .status,
    403,
  )
  assert.equal(saved, undefined)
  assert.equal(lookup.where.clienteId, 'alice')
  assert.equal(lookup.where.status, 'concluida')
  assert.deepEqual(lookup.where.OR, [
    { mercadoPagoStatus: 'approved' },
    { mercadoPagoId: null, mercadoPagoStatus: null },
  ])
  h.state.db.venda.findFirst = async () => ({ id: 'paid-order' })
  assert.equal(
    (await route.POST(h.request('/api/cliente/avaliacoes', 'POST', body)))
      .status,
    200,
  )
  assert.equal(saved.create.vendaId, 'paid-order')
  assert.equal(saved.create.clienteId, 'alice')
})

test('pet profiles reject a pet belonging to another ERP customer', async () => {
  const h = harness()
  h.state.user = { cliente: { id: 'alice' }, siggmaCliCod: 10 }
  h.state.animals = [{ id: 22, nome: 'Luna' }]
  const route = h.load('src/app/api/cliente/perfil-pet/route.ts')
  const body = {
    petKey: 'zetta:99',
    photo: null,
    size: 'medio',
    birthday: '2020-01-01',
    notes: null,
  }
  assert.equal(
    (await route.PUT(h.request('/api/cliente/perfil-pet', 'PUT', body))).status,
    404,
  )
  assert.equal(
    (
      await route.PUT(
        h.request('/api/cliente/perfil-pet', 'PUT', {
          ...body,
          birthday: '2024-02-31',
        }),
      )
    ).status,
    400,
  )
})

test('reorder caps quantities, refreshes ERP prices and excludes unavailable products', async () => {
  const h = harness()
  h.state.client = { id: 'alice' }
  h.state.official = { preco: 17, estoque: 2 }
  h.state.db.venda = {
    findFirst: async (args) => {
      assert.equal(args.where.clienteId, 'alice')
      return {
        itens: [
          {
            produtoId: 'p',
            quantidade: 3,
            produto: {
              id: 'p',
              nome: 'Ração',
              ativo: true,
              preco: 10,
              estoque: 20,
              zettaProCod: 1,
            },
          },
          {
            produtoId: 'gone',
            quantidade: 1,
            produto: { id: 'gone', nome: 'Antigo', ativo: false },
          },
        ],
      }
    },
  }
  const route = h.load('src/app/api/cliente/compras/repetir/route.ts')
  const result = await (
    await route.GET(h.request('/api/cliente/compras/repetir?id=order', 'GET'))
  ).json()
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].quantidade, 2)
  assert.equal(result.items[0].produto.preco, 17)
  assert.equal(result.notices.length, 2)
})

test('loyalty excludes freight, rounds per order and accounts for previously redeemed points', async () => {
  const h = harness()
  const helper = h.load('src/lib/customer-experience.ts')
  const balance = await helper.loyaltyBalance(
    {
      loyaltyConfig: {
        findUnique: async () => ({
          startsAt: new Date('2026-01-01'),
          spendCentsPerPoint: 100,
        }),
      },
      venda: {
        findMany: async (args) => {
          assert.equal(args.where.clienteId, 'alice')
          assert.equal(args.where.status, 'concluida')
          return [
            { total: 30.9, valorFrete: 20 },
            { total: 5.5, valorFrete: 0 },
          ]
        },
      },
      loyaltyRedemption: { findMany: async () => [{ points: 10 }] },
    },
    'alice',
  )
  assert.equal(balance.earned, 15)
  assert.equal(balance.balance, 5)
})

test('loyalty redemption cannot create coupons when balance is insufficient', async () => {
  const h = harness()
  h.state.client = { id: 'alice' }
  const tx = {
    $executeRaw: async () => 1,
    loyaltyConfig: {
      findUnique: async () => ({
        active: true,
        rewardPoints: 100,
        spendCentsPerPoint: 100,
        startsAt: new Date(),
      }),
    },
    venda: { findMany: async () => [] },
    loyaltyRedemption: { findMany: async () => [] },
  }
  h.state.db.$transaction = async (fn, options) => {
    assert.equal(options.isolationLevel, 'Serializable')
    return fn(tx)
  }
  const route = h.load('src/app/api/cliente/fidelidade/route.ts')
  assert.equal(
    (await route.POST(h.request('/api/cliente/fidelidade'))).status,
    409,
  )
})

test('personal loyalty coupons cannot be shared or reused while a payment is pending', async () => {
  const h = harness()
  const { validarCupom } = h.load('src/lib/cupons.ts')
  const client = {
    cupom: { findUnique: async () => ({ id: 'c', ativo: true }) },
    loyaltyRedemption: { findUnique: async () => ({ clienteId: 'alice' }) },
    cupomUso: { count: async () => 1 },
  }
  await assert.rejects(
    validarCupom(client, {
      codigo: 'CLUBE-123',
      subtotal: 100,
      clienteId: 'bob',
    }),
    /outro cliente/,
  )
  await assert.rejects(
    validarCupom(client, {
      codigo: 'CLUBE-123',
      subtotal: 100,
      clienteId: 'alice',
    }),
    /já está em uso/,
  )
})

test('direct Siggma booking requires an explicit release flag', () => {
  const booking = fs.readFileSync(
    path.join(root, 'src/lib/siggma/booking.ts'),
    'utf8',
  )
  const route = fs.readFileSync(
    path.join(root, 'src/app/api/cliente/agendamentos/route.ts'),
    'utf8',
  )
  assert.match(booking, /SIGGMA_AGENDAMENTO_DIRETO_ENABLED/)
  assert.match(booking, /directEnabled && expedienteId && services\.length/)
  assert.match(route, /!config\.configured/)
})

test('booking confirmations require a future time and a real agenda reference', async () => {
  const h = harness()
  h.state.admin = true
  const route = h.load('src/app/api/admin/relacionamento/route.ts')
  assert.equal(
    (
      await route.POST(
        h.request('/api/admin/relacionamento', 'POST', {
          action: 'booking',
          id: 'b',
          status: 'confirmado',
          reply: 'Confirmado!',
        }),
      )
    ).status,
    400,
  )
})

test(
  'migration creates isolated tables, preserves existing rows and enforces ownership references',
  { skip: !process.env.PGLITE_PATH },
  async () => {
    const { PGlite } = require(process.env.PGLITE_PATH)
    const db = new PGlite()
    try {
      await db.exec(
        'CREATE TABLE "Cliente" ("id" TEXT PRIMARY KEY); CREATE TABLE "Produto" ("id" TEXT PRIMARY KEY); CREATE TABLE "Venda" ("id" TEXT PRIMARY KEY); INSERT INTO "Cliente" VALUES (\'alice\'); INSERT INTO "Produto" VALUES (\'p\');',
      )
      await db.exec(
        fs.readFileSync(
          path.join(
            root,
            'prisma/migrations/20260928010000_customer_experience/migration.sql',
          ),
          'utf8',
        ),
      )
      await db.exec(
        'INSERT INTO "CustomerPreference" ("id","clienteId","produtoId","updatedAt") VALUES (\'f\',\'alice\',\'p\',NOW())',
      )
      await assert.rejects(
        db.exec(
          'INSERT INTO "CustomerPreference" ("id","clienteId","produtoId","updatedAt") VALUES (\'f2\',\'alice\',\'p\',NOW())',
        ),
        /unique/,
      )
      await assert.rejects(
        db.exec(
          'INSERT INTO "CustomerPreference" ("id","clienteId","produtoId","updatedAt") VALUES (\'f3\',\'other\',\'p\',NOW())',
        ),
        /foreign key/,
      )
      assert.equal(
        (await db.query('SELECT COUNT(*)::int AS n FROM "Cliente"')).rows[0].n,
        1,
      )
    } finally {
      await db.close()
    }
  },
)

function shippingHarness() {
  const h = harness()
  const config = {
    id: 'shipping', entregaPropriaAtiva: true, entregaPropriaValor: 20,
    entregaPropriaCepInicial: '02000-000', entregaPropriaCepFinal: '02999-999',
    entregaPropriaPrazo: 'Até 4 horas', retiradaAtiva: true,
    retiradaPrazo: 'Pronto para retirada em até 4 horas', retiradaEndereco: 'Loja',
    sedexAtivo: false, createdAt: new Date(), updatedAt: new Date(),
  }
  h.state.db.configuracaoFrete = { findFirst: async () => config }
  return h
}

test('motoboy quotes all authorized regions, including eastern and southern outer ranges', async () => {
  const h = shippingHarness()
  const { calcularOpcoesFrete } = h.load('src/lib/frete.ts')
  for (const [cep, region, price] of [
    ['02000-000', 'Zona Norte', 20], ['02999-999', 'Zona Norte', 20],
    ['05100-000', 'Zona Norte', 20], ['05299-999', 'Zona Norte', 20],
    ['01001-000', 'Centro', 30], ['01399-999', 'Centro', 30], ['01599-999', 'Centro', 30],
    ['03000-000', 'Zona Leste', 30], ['03999-999', 'Zona Leste', 30],
    ['08000-000', 'Zona Leste', 30], ['08499-999', 'Zona Leste', 30],
    ['04000-000', 'Zona Sul', 40], ['04999-999', 'Zona Sul', 40],
    ['05700-000', 'Zona Sul', 40], ['05899-999', 'Zona Sul', 40], ['04795000', 'Zona Sul', 40],
  ]) {
    const { opcoes } = await calcularOpcoesFrete(cep)
    const delivery = opcoes.find(o => o.tipo === 'entrega_propria')
    assert.equal(delivery?.valor, price, cep)
    assert.ok(delivery.label.includes(region), cep)
    assert.equal(opcoes.find(o => o.tipo === 'retirada')?.valor, 0)
  }
  for (const cep of ['', '02000', '020000000', '02000x000', '01400-000', '01600-000', '05000-000', '05300-000', '05699-999', '05900-000', '06000-000', '08500-000', '20040-020']) {
    const { opcoes } = await calcularOpcoesFrete(cep)
    assert.equal(opcoes.some(o => o.tipo === 'entrega_propria'), false, cep)
    assert.equal(opcoes.find(o => o.tipo === 'retirada')?.valor, 0, cep)
  }
})

test('checkout recalculates regional motoboy price and persists the correct order total', async () => {
  const h = shippingHarness()
  h.state.client = { id: 'shipping-client', endereco: 'Rua de teste, 123' }
  const product = { id: 'product', nome: 'Ração', ativo: true, preco: 50, estoqueHub: 10 }
  h.state.db.produto = { findMany: async () => [product] }
  let saved
  h.state.db.$transaction = async fn => fn({
    produto: { findUnique: async () => product, update: async () => product },
    venda: { create: async ({ data }) => {
      saved = data
      return { id: 'order', ...data, createdAt: new Date(), updatedAt: new Date() }
    } },
  })
  const route = h.load('src/app/api/cliente/carrinho/route.ts')
  for (const [cep, price] of [['02401-000', 20], ['01001-000', 30], ['08210-000', 30], ['04795-000', 40]]) {
    const result = await route.POST(h.request('/api/cliente/carrinho', 'POST', {
      itens: [{ produtoId: 'product', quantidade: 2 }], tipoEntrega: 'entrega_propria',
      cepEntrega: cep, valorFrete: 0, total: 1,
    }))
    assert.equal(result.status, 201, JSON.stringify(await result.json()))
    assert.equal(saved.valorFrete, price)
    assert.equal(saved.total, 100 + price)
    assert.equal(saved.cepEntrega, cep.replace('-', ''))
  }
  saved = null
  const rejected = await route.POST(h.request('/api/cliente/carrinho', 'POST', {
    itens: [{ produtoId: 'product', quantidade: 1 }], tipoEntrega: 'entrega_propria', cepEntrega: '06000-000', valorFrete: 20,
  }))
  assert.equal(rejected.status, 400)
  assert.equal(saved, null, 'Unsupported CEP must not create an order')
})
