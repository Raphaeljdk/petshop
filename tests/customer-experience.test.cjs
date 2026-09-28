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
