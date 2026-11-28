// Browser fixtures are intercepted in this test process only.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
const modulePath = process.env.PLAYWRIGHT_MODULE
if (!modulePath) throw new Error('Informe PLAYWRIGHT_MODULE para executar os testes da vitrine.')
const engines = await import(pathToFileURL(modulePath).href)
const engine = process.env.STORE_BROWSER || 'chromium'
const port = Number(process.env.STORE_TEST_PORT || 3197)
const base = 'http://127.0.0.1:' + port
const server = spawn(process.execPath, [resolve('.next/standalone/server.js')], {
  env: { ...process.env, PORT: String(port), HOSTNAME: '127.0.0.1' },
  stdio: 'ignore',
})
const now = new Date().toISOString()
const products = [
  ['racao', 'Ração para cães', 'PET_FOOD', 'Marca do teste', 80, 65],
  ['corda', 'Corda para gatos', 'Brinquedos', 'Marca do teste', 18, null],
  ['torre', 'Torre para gatos', 'Brinquedos', 'Segunda marca', 70, null],
  ['shampoo', 'Shampoo de banho', 'Higiene', 'Segunda marca', 21, null],
  ['brinde', 'Brinde sem saldo', 'Pet Shop', null, 1, null],
].map(([id, nome, categoria, marca, preco, precoPromo], i) => ({
  id,
  nome,
  categoria,
  marca,
  preco,
  precoPromo,
  estoque: i === 4 ? 0 : 3,
  imageUrl: i === 2 ? '/imagem-qa-indisponivel.webp' : '/images/vitrine/corda.webp',
  createdAt: i < 2 ? now : '2020-01-01T12:00:00.000Z',
  bestSellerRank: i === 1 ? 1 : undefined,
}))
const plans = [
  {
    id: 'plano-a',
    title: 'Plano de teste A',
    description: 'Condição da loja',
    sessions: 4,
    priceCents: 18000,
    durationDays: 30,
  },
  {
    id: 'plano-b',
    title: 'Plano de teste B',
    description: 'Outra condição',
    sessions: 8,
    priceCents: 32000,
    durationDays: 60,
  },
]
let browser
const pass = (label) => console.log('PASS ' + label)
try {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(base + '/loja')).ok) break
    } catch {}
    if (i === 119 || server.exitCode !== null) throw new Error('Servidor indisponível')
    await new Promise((r) => setTimeout(r, 120))
  }
  const config = process.env.STORE_BROWSER_CONFIG ? JSON.parse(process.env.STORE_BROWSER_CONFIG) : {}
  browser = await engines[engine === 'chrome' || engine === 'edge' ? 'chromium' : engine].launch({
    headless: true,
    ...config,
  })
  console.log('Navegador', engine, browser.version())
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    locale: 'pt-BR',
  })
  let signed = false,
    mode = 'normal',
    reads = 0,
    saved = false
  await ctx.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/public/produtos') {
      reads++
      if (mode === 'erro') return route.fulfill({ status: 503, json: { error: 'indisponível' } })
      if (mode === 'lento') await new Promise((r) => setTimeout(r, 850))
      return route.fulfill({ json: mode === 'vazio' ? products.filter((p) => !p.estoque) : products })
    }
    if (path === '/api/auth/me')
      return route.fulfill({
        json: signed
          ? {
              autenticado: true,
              user: {
                id: 'qa',
                role: 'CLIENTE',
                nome: 'Tutor QA',
                email: 'cliente@example.test',
                clienteId: 'qa',
              },
              cliente: { id: 'qa', nome: 'Tutor QA', pets: [] },
            }
          : { autenticado: false },
      })
    if (path === '/api/cliente/preferencias') {
      if (route.request().method() === 'PUT') {
        saved = route.request().postDataJSON().favorite
        return route.fulfill({ json: { favorite: saved } })
      }
      return route.fulfill({ json: saved ? [{ produtoId: 'corda', favorite: true }] : [] })
    }
    if (path === '/api/public/avaliacoes')
      return route.fulfill({ json: { count: 0, average: null, reviews: [] } })
    if (path === '/api/public/blog')
      return route.fulfill({
        json: {
          articles: [
            {
              id: 'editorial',
              title: 'Higiene do pet',
              category: 'Higiene',
              summary: 'Cuidados diários',
              body: 'Artigo publicado da loja.',
              createdAt: now,
              productId: 'shampoo',
            },
          ],
        },
      })
    if (path === '/api/public/vitrine')
      return route.fulfill({ json: { plans, coupons: [], services: { Banho: { min: 55, max: 55 } } } })
    if (path.startsWith('/api/public/produtos/'))
      return route.fulfill({ json: products.find((p) => p.id === path.split('/').at(-1)) })
    if (path === '/api/cliente/produtos') return route.fulfill({ json: products })
    if (path === '/api/cliente/portal')
      return route.fulfill({
        json: {
          plans,
          articles: [],
          favorites: [],
          requests: [],
          pets: [],
          memories: [],
          preferences: {},
          gifts: [],
          outgoing: [],
          incoming: [],
          claims: [],
          likedProducts: [],
        },
      })
    if (path === '/api/cliente/agendamentos/servicos')
      return route.fulfill({ json: { configured: false, writeConfigured: false, services: [] } })
    if (path === '/api/cliente/loja/status')
      return route.fulfill({ json: { siggmaOrderWriteConfigured: false } })
    return route.fulfill({ json: [] })
  })
  await ctx.addInitScript(() => {
    sessionStorage.setItem('matilha:install:seen:v1', '1')
    window.shopEvents = []
    window.addEventListener('matilha:store-event', (e) => window.shopEvents.push(e.detail))
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(8500)
  const errors = []
  page.on('pageerror', (err) => {
    errors.push(err.message)
    console.error('Browser:', err.message)
  })
  const btn = (name) => page.getByRole('button', { name, exact: true })
  const count = () => page.locator('.mp-product').count()
  await page.goto(base + '/')
  await page.getByRole('heading', { name: /Cuidado completo/ }).waitFor()
  await page.locator('.mp-product').first().waitFor()
  const images = await page.locator('.mp-husky>img,.mp-spa-photo,.mp-prop img').evaluateAll((nodes) =>
    Promise.all(
      nodes.map(async (img) => {
        await img.decode()
        return img.naturalWidth
      }),
    ),
  )
  assert.ok(images.every(Boolean))
  pass('imagens do Husky, banho e objetos carregadas')
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => document.fonts.ready)
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'overflow a ' + width,
    )
    if (width < 768) {
      const bounds = await page.locator('.mp-bottom').boundingBox()
      const help = await page.getByRole('link', { name: /arraste para reposicionar/ }).boundingBox()
      assert.ok(bounds && bounds.y + bounds.height <= 901)
      if (help) assert.ok(help.y + help.height <= bounds.y + 1)
    }
    if (width === 390 || width === 1280) {
      const path = 'tests/visual/vitrine-' + width + '.webp'
      const png = await page.locator('.mp-hero').screenshot({ animations: 'disabled' })
      if (process.env.UPDATE_STOREFRONT_BASELINES === '1') {
        await mkdir('tests/visual', { recursive: true })
        await writeFile(path, await sharp(png).resize(480).webp({ quality: 90 }).toBuffer())
      }
      const pixels = (src) => sharp(src).resize(96, 48, { fit: 'fill' }).removeAlpha().raw().toBuffer()
      const [actual, expected] = await Promise.all([pixels(png), pixels(await readFile(path))])
      const distance =
        actual.reduce((sum, b, i) => sum + Math.abs(b - expected[i]), 0) / (actual.length * 255)
      if (distance >= 0.055) {
        await mkdir('test-results/vitrine', { recursive: true })
        await writeFile('test-results/vitrine/' + engine + '-' + width + '.png', png)
      }
      assert.ok(distance < 0.055, 'diferença visual ' + width + ' = ' + distance.toFixed(4))
    }
  }
  pass('320, 390, 768 e 1280 px; regressão visual do hero no celular e desktop')
  assert.equal(await count(), 4)
  await btn('Mais vendidos').click()
  assert.equal(await count(), 1)
  await btn('Novidades').click()
  assert.equal(await count(), 2)
  await btn('Ofertas da semana').click()
  assert.equal(await count(), 1)
  await btn('Todos os produtos').click()
  const startReads = reads
  const input = page.getByRole('searchbox', { name: /Buscar por produto/ })
  await input.fill('brinqueods')
  assert.equal(await count(), 2)
  await input.press('Enter')
  await input.fill('')
  await input.blur()
  await input.focus()
  await page.getByText('Buscas recentes', { exact: true }).waitFor()
  await input.fill('inexistente')
  await page.getByText(/Nenhum produto encontrado/).waitFor()
  await input.fill('')
  await input.press('Escape')
  await page.getByLabel('Ordenar produtos').selectOption('menor')
  assert.match(await page.locator('.mp-product strong').first().innerText(), /Corda/)
  assert.equal(reads, startReads)
  pass('estoque, coleções, busca por erro de digitação, recentes e ordenação sem nova consulta')
  await page.locator('#categorias').getByRole('button', { name: 'Brinquedos', exact: true }).click()
  assert.equal(await count(), 2)
  await page.locator('#marcas').getByRole('button', { name: 'Segunda marca', exact: true }).click()
  assert.equal(await count(), 2)
  await page.getByRole('button', { name: 'Limpar filtro' }).click()
  await page.locator('.mp-product-grid').getByRole('button', { name: /Corda para gatos/ }).click()
  await page.getByRole('dialog').waitFor()
  assert.match(
    decodeURIComponent(
      await page.getByRole('link', { name: 'Compartilhar no WhatsApp' }).getAttribute('href'),
    ),
    /\/loja\?produto=corda/,
  )
  await btn('Torre para gatos').click()
  await page.keyboard.press('Escape')
  assert.equal(await page.evaluate(() => window.shopEvents.length), 0)
  await btn('Preferências de privacidade').click()
  await page.getByLabel(/Medição de uso/).check()
  await btn('Salvar preferências').click()
  await page.locator('.mp-product-grid').getByRole('button', { name: /Corda para gatos/ }).click()
  await page.waitForFunction(() => window.shopEvents.length === 1)
  const detail = await page.evaluate(() => window.shopEvents[0])
  assert.deepEqual(detail.data.items, [{ item_id: 'corda' }])
  assert.deepEqual(detail.consent, { analytics: true, ads: false })
  await page.keyboard.press('Escape')
  pass('filtros, visualização rápida, relacionados, compartilhamento e consentimento')
  await btn('Comparar planos').click()
  await page.getByRole('table').waitFor()
  await btn('Solicitar este plano').first().click()
  await page.getByRole('dialog').waitFor()
  await page.keyboard.press('Escape')
  await btn('Agendar banho e tosa').click()
  await page.getByRole('dialog').waitFor()
  await page.keyboard.press('Escape')
  const blog = page.locator('#blog')
  for (const title of ['O primeiro banho do pet', 'Como organizar os itens de higiene do pet', 'O que conferir ao repor o alimento', 'Como apresentar um brinquedo novo']) {
    await blog.getByRole('button', { name: 'Ler guia ' + title, exact: true }).click()
    await blog.getByRole('article').getByRole('heading', { name: title }).waitFor()
    await blog.getByRole('button', { name: 'Voltar ao blog' }).click()
  }
  await blog.getByRole('button', { name: /^Ler artigo / }).click()
  await page.getByText('Artigo publicado da loja.').waitFor()
  pass('consulta de planos, entrada no agendamento e leitura do blog')
  mode = 'erro'
  await page.goto(base + '/loja')
  await page.getByText(/catálogo está temporariamente/).waitFor()
  mode = 'vazio'
  await page.locator('#produtos').getByRole('button', { name: 'Tentar novamente' }).click()
  await page.getByText(/Nenhum produto em estoque/).waitFor()
  mode = 'lento'
  await page.goto(base + '/loja', { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: /Cuidado completo/ }).waitFor()
  await page.locator('.mp-product').first().waitFor()
  pass('erro de API, nova tentativa, estoque zerado e catálogo lento')
  signed = true
  mode = 'normal'
  await page.goto(base + '/loja?produto=corda')
  await page.getByRole('dialog').waitFor()
  await page.keyboard.press('Escape')
  await btn('Favoritar Corda para gatos').click()
  assert.equal(saved, true)
  await page.reload()
  await page.getByRole('dialog').waitFor()
  await page.keyboard.press('Escape')
  assert.equal(await btn('Favoritar Corda para gatos').getAttribute('aria-pressed'), 'true')
  await btn('Agendar banho e tosa').click()
  await page.getByRole('heading', { name: 'Agendar pelo portal' }).waitFor()
  await page.goto(base + '/loja')
  await btn('Abrir carrinho').click()
  await page.locator('.cart-sheet').waitFor()
  pass('link direto, favorito salvo na conta, agendamento e carrinho autenticados')
  assert.deepEqual(errors, [])
  pass('sem exceções não tratadas no navegador')
  await ctx.close()
} finally {
  await browser?.close()
  server.kill()
}
