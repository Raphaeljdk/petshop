/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { PrismaClient } from '@prisma/client'
import { createHash, randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import type { Subprocess } from 'bun'

if (!/postgresql:\/\/[^/]+\/matilha_auth_test\b/.test(process.env.DATABASE_URL || '')) {
  throw new Error('Use exclusivamente o banco Postgres isolado de teste matilha_auth_test.')
}
const db = new PrismaClient()
const base = 'http://localhost:3101'
const prefix = 'auth-' + randomBytes(6).toString('hex')
const password = 'Matilha9-' + randomBytes(10).toString('hex')
let server: Subprocess
const email = (name: string) => prefix + '-' + name + '@example.test'
const client = (name: string) => ({ nome: 'Cliente de Teste', email: email(name), telefone: '(11) 99999-1234', senha: password, confirmarSenha: password, role: 'CLIENTE' })
async function post(path: string, data: unknown, cookie?: string, origin = base) {
  return fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(data) })
}
function cookieOf(res: Response) { return res.headers.get('set-cookie')!.split(';')[0] }
async function invite(name: string, extra: { expiresAt?: Date; revokedAt?: Date; createdById?: string } = {}) {
  const code = randomBytes(32).toString('hex')
  const record = await db.adminInvitation.create({
    data: { email: email(name), tokenHash: createHash('sha256').update(code).digest('hex'), expiresAt: new Date(Date.now() + 60_000), ...extra },
  })
  return { code, record }
}
const adminBody = (name: string, code: string) => ({ nome: 'Administrador Teste', email: email(name), senha: password, confirmarSenha: password, role: 'ADMIN', convite: code })

beforeAll(async () => {
  server = Bun.spawn(['bun', resolve('.next/standalone/server.js')], {
    env: { ...process.env, PORT: '3101', HOSTNAME: '127.0.0.1', NODE_ENV: 'production' },
    stdout: 'ignore', stderr: 'inherit',
  })
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(base + '/api/auth/me')).ok) return } catch {}
    if (server.exitCode !== null) throw new Error('Servidor de teste encerrou antes de iniciar.')
    await Bun.sleep(200)
  }
  throw new Error('Servidor de teste não iniciou.')
}, 30_000)
afterAll(async () => { server?.kill(); await db.$disconnect() })

test('cadastro de cliente normaliza os dados, cria sessão e não retorna a senha', async () => {
  const res = await post('/api/auth/register', { ...client('new'), email: email('new').toUpperCase(), nome: ' Cliente de Teste ' })
  expect(res.status).toBe(201)
  const body = await res.json()
  expect(body.user.role).toBe('CLIENTE')
  expect(body.user.email).toBe(email('new'))
  expect(body.user).not.toHaveProperty('senha')
  const cookie = res.headers.get('set-cookie')!
  expect(cookie).toContain('HttpOnly')
  expect(cookie).toContain('Secure')
  expect(cookie).toContain('SameSite=lax')
  expect(cookie).not.toContain('Max-Age')
  const me = await fetch(base + '/api/auth/me', { headers: { Cookie: cookieOf(res) } })
  const session = await me.json()
  expect(session.autenticado).toBe(true)
  expect(session.cliente.telefone).toBe('11999991234')
  expect(me.headers.get('cache-control')).toBe('no-store')
})

test('cadastro público rejeita tentativa de elevar o papel e campos malformados', async () => {
  expect((await post('/api/auth/register', { ...client('elevate'), role: 'ADMIN' })).status).toBe(400)
  expect((await post('/api/auth/register', { ...client('type'), email: { invalid: true } })).status).toBe(400)
  expect(await db.user.findUnique({ where: { email: email('elevate') } })).toBeNull()
})

test('valida confirmação, senha fraca e limite em bytes antes de salvar', async () => {
  const mismatch = await post('/api/auth/register', { ...client('mismatch'), confirmarSenha: 'outra-senha' })
  expect(mismatch.status).toBe(400)
  expect((await mismatch.json()).fields.confirmarSenha).toBeTruthy()
  expect((await post('/api/auth/register', { ...client('weak'), senha: '123', confirmarSenha: '123' })).status).toBe(400)
  const long = 'A1' + '😀'.repeat(20)
  expect((await post('/api/auth/register', { ...client('bytes'), senha: long, confirmarSenha: long })).status).toBe(400)
})

test('e-mail de cliente antigo não permite tomar sua conta nem sobrescrever seus dados', async () => {
  const existing = await db.cliente.create({ data: { nome: 'Cliente original', telefone: '1133334444', email: email('existing') } })
  expect((await post('/api/auth/register', client('existing'))).status).toBe(409)
  expect((await db.cliente.findUnique({ where: { id: existing.id } }))?.nome).toBe('Cliente original')
  expect(await db.user.findUnique({ where: { email: email('existing') } })).toBeNull()
})

test('cadastro duplicado não deixa clientes órfãos', async () => {
  expect((await post('/api/auth/register', client('duplicate'))).status).toBe(201)
  expect((await post('/api/auth/register', client('duplicate'))).status).toBe(409)
  expect(await db.user.count({ where: { email: email('duplicate') } })).toBe(1)
  expect(await db.cliente.count({ where: { email: email('duplicate') } })).toBe(1)
})

test('login mantém sessão por sete dias somente quando solicitado e logout remove o cookie', async () => {
  await post('/api/auth/register', client('remember'))
  const res = await post('/api/auth/login', { email: email('remember'), senha: password, lembrar: true })
  expect(res.status).toBe(200)
  expect(res.headers.get('set-cookie')).toContain('Max-Age=604800')
  const logout = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Cookie: cookieOf(res), Origin: base } })
  expect(logout.status).toBe(200)
  expect(logout.headers.get('set-cookie')).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i)
})

test('login rejeita conta desativada e senha errada com a mesma resposta', async () => {
  await post('/api/auth/register', client('disabled'))
  const wrong = await post('/api/auth/login', { email: email('disabled'), senha: 'SenhaErrada99' })
  await db.user.update({ where: { email: email('disabled') }, data: { ativo: false } })
  const inactive = await post('/api/auth/login', { email: email('disabled'), senha: password })
  expect(wrong.status).toBe(401)
  expect(inactive.status).toBe(401)
  expect(await wrong.json()).toEqual(await inactive.json())
})

test('recusa JSON inválido e requisições de outra origem', async () => {
  const invalid = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })
  expect(invalid.status).toBe(400)
  expect((await post('/api/auth/register', client('csrf'), undefined, 'https://outside.example')).status).toBe(403)
})

test('administrador exige convite válido e o mesmo e-mail', async () => {
  expect((await post('/api/auth/register/admin', adminBody('without', 'a'.repeat(64)))).status).toBe(403)
  const { code, record } = await invite('owner')
  expect((await post('/api/auth/register/admin', adminBody('stranger', code))).status).toBe(403)
  expect((await db.adminInvitation.findUnique({ where: { id: record.id } }))?.usedAt).toBeNull()
})

test('convites expirados, revogados e de administradores inativos não criam acesso', async () => {
  const expired = await invite('expired', { expiresAt: new Date(Date.now() - 60_000) })
  const revoked = await invite('revoked', { revokedAt: new Date() })
  expect((await post('/api/auth/register/admin', adminBody('expired', expired.code))).status).toBe(403)
  expect((await post('/api/auth/register/admin', adminBody('revoked', revoked.code))).status).toBe(403)
  const issuerInvite = await invite('issuer')
  await post('/api/auth/register/admin', adminBody('issuer', issuerInvite.code))
  const issuer = await db.user.update({ where: { email: email('issuer') }, data: { ativo: false } })
  const child = await invite('child', { createdById: issuer.id })
  expect((await post('/api/auth/register/admin', adminBody('child', child.code))).status).toBe(403)
})

test('convite válido cria apenas um administrador e não pode ser reutilizado', async () => {
  const { code, record } = await invite('accepted')
  const res = await post('/api/auth/register/admin', adminBody('accepted', code))
  expect(res.status).toBe(201)
  const body = await res.json()
  expect(body.user.role).toBe('ADMIN')
  expect(body.user.clienteId).toBeNull()
  expect((await db.adminInvitation.findUnique({ where: { id: record.id } }))?.usedAt).not.toBeNull()
  expect((await post('/api/auth/register/admin', adminBody('accepted', code))).status).toBe(403)
  expect(await db.user.count({ where: { email: email('accepted') } })).toBe(1)
})

test('requisições simultâneas não reutilizam o mesmo convite', async () => {
  const { code } = await invite('race')
  const responses = await Promise.all([post('/api/auth/register/admin', adminBody('race', code)), post('/api/auth/register/admin', adminBody('race', code))])
  expect(responses.filter(res => res.status === 201).length).toBe(1)
  expect(await db.user.count({ where: { email: email('race') } })).toBe(1)
}, 15_000)

test('falha por conta já existente não consome convite', async () => {
  await post('/api/auth/register', client('rollback'))
  const { code, record } = await invite('rollback')
  expect((await post('/api/auth/register/admin', adminBody('rollback', code))).status).toBe(409)
  expect((await db.adminInvitation.findUnique({ where: { id: record.id } }))?.usedAt).toBeNull()
})

test('clientes não podem consultar, gerar ou revogar convites', async () => {
  const registered = await post('/api/auth/register', client('no-permission'))
  const cookie = cookieOf(registered)
  expect((await fetch(base + '/api/admin/convites')).status).toBe(401)
  expect((await fetch(base + '/api/admin/convites', { headers: { Cookie: cookie } })).status).toBe(403)
  expect((await post('/api/admin/convites', { email: email('blocked-invite') }, cookie)).status).toBe(403)
  expect((await fetch(base + '/api/admin/convites?id=unknown', { method: 'DELETE', headers: { Cookie: cookie, Origin: base } })).status).toBe(403)
})

test('admin gera código uma vez, lista sem hash, revoga e substitui convites', async () => {
  const seed = await invite('manager')
  const login = await post('/api/auth/register/admin', adminBody('manager', seed.code))
  const cookie = cookieOf(login)
  const first = await post('/api/admin/convites', { email: email('invited') }, cookie)
  expect(first.status).toBe(201)
  const issued = await first.json()
  expect(issued.code).toMatch(/^[a-f0-9]{64}$/)
  const list = await fetch(base + '/api/admin/convites', { headers: { Cookie: cookie } })
  const listed = await list.text()
  expect(listed).not.toContain(issued.code)
  expect(listed).not.toContain('tokenHash')
  const second = await post('/api/admin/convites', { email: email('invited') }, cookie)
  expect(second.status).toBe(201)
  expect((await post('/api/auth/register/admin', adminBody('invited', issued.code))).status).toBe(403)
  const replacement = await second.json()
  expect((await fetch(base + '/api/admin/convites?id=' + replacement.invitation.id, { method: 'DELETE', headers: { Cookie: cookie, Origin: base } })).status).toBe(200)
  expect((await post('/api/auth/register/admin', adminBody('invited', replacement.code))).status).toBe(403)
})

test('limita repetição de tentativas de login e informa quando tentar novamente', async () => {
  for (let i = 0; i < 10; i++) {
    expect((await post('/api/auth/login', { email: email('limited'), senha: 'Errada99999' })).status).toBe(401)
  }
  const limited = await post('/api/auth/login', { email: email('limited'), senha: 'Errada99999' })
  expect(limited.status).toBe(429)
  expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
}, 20_000)
