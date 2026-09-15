import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

if (!/postgresql:\/\/[^/]+\/matilha_auth_test\b/.test(process.env.DATABASE_URL || '') || !process.env.PLAYWRIGHT_MODULE) {
  throw new Error('Use o banco Postgres isolado de teste matilha_auth_test e informe PLAYWRIGHT_MODULE.')
}
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
const db = new PrismaClient()
const base = 'http://localhost:3102'
const server = spawn(process.execPath, [resolve('.next/standalone/server.js')], {
  env: { ...process.env, PORT: '3102', HOSTNAME: '127.0.0.1', NODE_ENV: 'production' },
  stdio: ['ignore', 'ignore', 'inherit'],
})
let browser
let checks = 0
const passed = name => { checks++; console.log('PASS: ' + name) }
const prefix = 'ui-' + randomBytes(6).toString('hex')
const password = 'Matilha9-' + randomBytes(10).toString('hex')
const email = prefix + '@example.test'
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/api/auth/me')).ok) break } catch {}
    if (i === 99 || server.exitCode !== null) throw new Error('Servidor não iniciou.')
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  await mkdir('test-results/auth', { recursive: true })
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
      args: JSON.parse(process.env.PLAYWRIGHT_LAUNCH_ARGS || '[]'),
    } : {}),
  })
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 960 })
    for (const route of ['/login', '/cadastro', '/cadastro/administrador']) {
      await page.goto(base + route)
      await page.getByLabel('E-mail', { exact: true }).waitFor()
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Sem overflow em ' + route + ' / ' + width)
      assert.ok(await page.getByRole('button', { name: 'Sou administrador' }).isVisible())
      await page.screenshot({ path: 'test-results/auth/' + route.slice(1).replaceAll('/', '-') + '-' + width + '.png', fullPage: true })
      passed(route + ' responsivo a ' + width + 'px')
    }
  }
  await page.goto(base + '/')
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  assert.ok(await page.getByRole('button', { name: 'Cadastrar', exact: true }).evaluate(el => el === document.activeElement))
  passed('Modal abre, fecha por teclado e restaura foco')

  await page.goto(base + '/cadastro')
  await page.getByLabel('Nome completo').fill('Cliente Teste')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Telefone com DDD').fill('11999991234')
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Mostrar senha', exact: true }).click()
  assert.equal(await page.getByLabel('Senha', { exact: true }).getAttribute('type'), 'text')
  await page.getByLabel('Confirmar senha', { exact: true }).fill('OutraSenha999')
  await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click()
  await page.getByText('As senhas não coincidem.').waitFor()
  await page.waitForFunction(() => document.activeElement?.getAttribute('name') === 'confirmarSenha')
  passed('Senha visível e confirmação com erro e foco no campo')

  await page.getByLabel('Confirmar senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click()
  await page.getByRole('navigation', { name: 'Navegação do cliente' }).waitFor()
  assert.ok((await context.cookies()).some(cookie => cookie.name === 'matilha_token' && cookie.httpOnly))
  passed('Cadastro real de cliente abre o portal com sessão')
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).waitFor()

  const adminEmail = prefix + '-admin@example.test'
  const code = randomBytes(32).toString('hex')
  await db.adminInvitation.create({ data: { email: adminEmail, tokenHash: createHash('sha256').update(code).digest('hex'), expiresAt: new Date(Date.now() + 600_000) } })
  await page.goto(base + '/cadastro/administrador')
  await page.getByLabel('Nome completo').fill('Administrador Teste')
  await page.getByLabel('E-mail', { exact: true }).fill(adminEmail)
  await page.getByLabel('Código de convite', { exact: true }).fill(code)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByLabel('Confirmar senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Criar conta de administrador', exact: true }).click()
  await page.getByRole('navigation', { name: 'Navegação administrativa' }).waitFor()
  await page.getByRole('button', { name: 'Equipe e convites', exact: true }).click()
  await page.getByRole('heading', { name: 'Equipe e convites' }).waitFor()
  passed('Cadastro real de administrador abre a gestão de equipe')

  await page.getByLabel('E-mail do administrador').fill(prefix + '-convite@example.test')
  await page.getByRole('button', { name: 'Gerar convite', exact: true }).click()
  await page.getByRole('heading', { name: 'Convite pronto' }).waitFor()
  assert.equal((await page.getByLabel('Código gerado').inputValue()).length, 64)
  await page.getByRole('button', { name: 'Já salvei o convite', exact: true }).click()
  await page.getByRole('button', { name: 'Revogar', exact: true }).first().click()
  await page.getByRole('button', { name: 'Confirmar revogação', exact: true }).click()
  await page.getByText('Convite revogado. O código não pode mais ser usado.').waitFor()
  passed('Admin gera e revoga convite pelo painel')

  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click()
  await page.getByRole('navigation', { name: 'Navegação do cliente' }).waitFor()
  await page.waitForURL('**/#inicio')
  passed('Troca de administrador para cliente não mantém a aba da equipe')

  const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } })
  const reducedPage = await reduced.newPage()
  await reducedPage.goto(base + '/login')
  await reducedPage.getByLabel('E-mail', { exact: true }).waitFor()
  assert.equal(await reducedPage.locator('.account-page-card').evaluate(el => getComputedStyle(el).animationName), 'none')
  passed('Preferência de movimento reduzido respeitada')
  assert.deepEqual(errors, [], 'Sem erros de JavaScript nas telas')
  console.log(checks + ' verificações de interface concluídas.')
} finally {
  await browser?.close()
  server.kill()
  await db.$disconnect()
}
