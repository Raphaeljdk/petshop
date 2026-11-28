// Native Safari smoke test on a macOS runner with Remote Automation enabled.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
const app = spawn(process.execPath, [resolve('.next/standalone/server.js')], {
  env: { ...process.env, PORT: '3191', HOSTNAME: '127.0.0.1' },
  stdio: 'ignore',
})
const driver = spawn('safaridriver', ['--port', '4455'], { stdio: 'inherit' })
const remote = 'http://127.0.0.1:4455'
let session
async function command(path, method = 'GET', body) {
  const response = await fetch(remote + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const { value } = await response.json()
  if (!response.ok || value?.error) throw Error(value?.message || 'SafariDriver HTTP ' + response.status)
  return value
}
async function until(check) {
  for (let i = 0; i < 80; i++) {
    try {
      if (await check()) return
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('O estado esperado não foi alcançado no Safari.')
}
try {
  await until(() => command('/status'))
  await until(async () => (await fetch('http://127.0.0.1:3191/loja')).ok)
  const created = await command('/session', 'POST', {
    capabilities: { alwaysMatch: { browserName: 'safari' } },
  })
  session = '/session/' + created.sessionId
  const evaluate = (script) => command(session + '/execute/sync', 'POST', { script, args: [] })
  await command(session + '/url', 'POST', { url: 'http://127.0.0.1:3191/loja' })
  await until(() =>
    evaluate(
      "return document.querySelector('.mp-husky img')?.naturalWidth > 0 && document.querySelector('#mp-search')",
    ),
  )
  for (const width of [768, 1280]) {
    await command(session + '/window/rect', 'POST', { width, height: 900 })
    assert.ok(await evaluate('return document.documentElement.scrollWidth<=innerWidth+1'))
  }
  await evaluate('document.querySelector(\'.mp-tools [aria-label="Buscar produtos"]\').click()')
  await until(() => evaluate("return document.activeElement?.id==='mp-search'"))
  await evaluate('document.querySelector(\'.mp-tools [aria-label="Minha conta"]\').click()')
  await until(() => evaluate('return !!document.querySelector("[role=dialog]")'))
  console.log(
    'Safari',
    created.capabilities.browserVersion,
    '— imagem, duas larguras, busca e acesso à conta aprovados.',
  )
} finally {
  if (session) await command(session, 'DELETE').catch(() => {})
  driver.kill()
  app.kill()
}
