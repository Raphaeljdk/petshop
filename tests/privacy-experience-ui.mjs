// UI fixtures only. Real authentication is tested separately in auth-ui.mjs.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'

if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Informe PLAYWRIGHT_MODULE.')
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const base = 'http://127.0.0.1:3103'
const server = spawn(process.execPath, [resolve('.next/standalone/server.js')], {
  env: { ...process.env, PORT: '3103', HOSTNAME: '127.0.0.1', NODE_ENV: 'production' },
  stdio: ['ignore', 'ignore', 'inherit'],
})
let browser
const customer = { id: 'fixture', nome: 'Marina', email: 'marina@example.test', telefone: '11999999999', endereco: null, cep: null }
const pet = { id: 'luna', nome: 'Luna', especie: 'cachorro', raca: null, fotoUrl: null }
const dashboard = {
  cliente: customer,
  stats: { totalPets: 1, totalAgendamentos: 1, totalCompras: 0, totalGasto: 0, processosAtivos: 0 },
  pets: [pet], proximosAgendamentos: [{ id: 'appointment', pet, servico: 'banho', status: 'confirmado', dataHora: '2030-12-20T14:00:00.000Z' }],
  ultimasCompras: [], produtosDestaque: [],
}
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/privacidade')).ok) break } catch {}
    if (i === 99 || server.exitCode !== null) throw new Error('Servidor não iniciou.')
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  await mkdir('test-results/auth', { recursive: true })
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: JSON.parse(process.env.PLAYWRIGHT_LAUNCH_ARGS || '[]'),
  } : {}) })
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  await context.addInitScript(() => sessionStorage.setItem('matilha:install:seen:v1', '1'))
  let signedIn = false
  let currentDashboard = dashboard
  await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    const body = path === '/api/auth/me' ? (signedIn ? { autenticado: true, user: { ...customer, role: 'CLIENTE', clienteId: customer.id }, cliente: customer } : { autenticado: false })
      : path === '/api/cliente/dashboard' ? currentDashboard
        : path === '/api/cliente/fidelidade' ? { config: null, earned: 0, used: 0, balance: 0, redemptions: [] }
          : path === '/api/cliente/agendamentos/servicos' ? { configured: false, writeConfigured: false, services: [], fallback: 'solicitacao-equipe' }
            : path === '/api/cliente/pets' ? currentDashboard.pets : []
    return route.fulfill({ json: body })
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const noOverflow = async label => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 })
    for (const path of ['/login', '/cadastro', '/ativar-conta']) {
      await page.goto(base + path)
      await page.getByRole('complementary', { name: 'Privacidade e LGPD' }).waitFor()
      const link = page.getByRole('link', { name: /Privacidade e seus direitos/ })
      assert.equal(await link.getAttribute('href'), '/privacidade')
      assert.equal(await link.getAttribute('target'), '_blank')
      assert.equal(await page.getByLabel('Nome do pet', { exact: true }).count(), 0)
      await noOverflow(path + ' / ' + width)
    }
    await page.goto(base + '/privacidade')
    await page.getByRole('heading', { level: 1, name: 'Seus dados também merecem cuidado.' }).waitFor()
    await noOverflow('privacidade / ' + width)
    assert.match(await page.getByRole('link', { name: /Falar sobre meus dados/ }).getAttribute('href'), /^https:\/\/wa\.me\/5511915942356\?text=/)
    await page.screenshot({ path: `test-results/auth/privacidade-${width}.png`, fullPage: true })
    console.log(`PASS: LGPD, login, cadastro e ativação em ${width}px`)
  }
  await page.goto(base + '/login')
  await page.getByLabel('E-mail ou telefone', { exact: true }).fill('marina@example.test')
  await page.getByRole('button', { name: 'Preciso de ajuda' }).click()
  assert.match(await page.getByRole('link', { name: /Conversar com a equipe/ }).getAttribute('href'), /^https:\/\/wa\.me\//)
  await page.locator('summary').filter({ hasText: 'Já é cliente da loja' }).click()
  assert.equal(await page.getByRole('link', { name: /Pedir ajuda com o primeiro acesso/ }).isVisible(), true)
  assert.equal(await page.getByLabel('E-mail ou telefone', { exact: true }).inputValue(), 'marina@example.test')
  assert.equal(await page.getByLabel('Manter conectado por 7 dias').isChecked(), false)
  console.log('PASS: ajuda preserva dados digitados; sessão persistente é opcional')
  signedIn = true
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 960 })
    await page.goto(base)
    await page.getByRole('heading', { name: 'O próximo encontro de Luna' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Ver meu agendamento' }).isVisible(), true)
    await noOverflow('portal / ' + width)
    await page.screenshot({ path: `test-results/auth/portal-personalizado-${width}.png`, fullPage: true })
  }
  await page.getByRole('button', { name: 'Ver meu agendamento' }).click()
  await page.waitForURL('**/#agendamentos')
  await page.getByRole('heading', { name: 'Solicitar pelo portal', exact: true }).waitFor()
  currentDashboard = { ...dashboard, stats: { ...dashboard.stats, processosAtivos: 1 } }
  await page.goto(base)
  await page.getByRole('heading', { name: 'Tem cuidado acontecendo por aqui.' }).waitFor()
  currentDashboard = { ...dashboard, proximosAgendamentos: [] }
  await page.reload()
  await page.getByRole('heading', { name: 'Que tal reservar um momento de cuidado?' }).waitFor()
  currentDashboard = { ...dashboard, pets: [], proximosAgendamentos: [], stats: { ...dashboard.stats, totalPets: 0 } }
  await page.reload()
  await page.getByRole('heading', { name: 'Cada amizade tem uma história. Vamos conhecer a sua?' }).waitFor()
  console.log('PASS: próximo cuidado, navegação e conta sem pets')
  assert.deepEqual(errors, [], 'Sem erros JavaScript no navegador')
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
