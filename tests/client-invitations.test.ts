import { afterAll, expect, test } from 'bun:test'
import { randomBytes } from 'node:crypto'
import { db } from '../src/lib/db'
import { acceptClientInvitation, hashInvitation, issueClientInvitation, invitationMailConfig, sendClientInvitation } from '../src/lib/client-invitations'

if (!/postgresql:\/\/[^/]+\/matilha_auth_test\b/.test(process.env.DATABASE_URL || '')) throw new Error('Use apenas o banco isolado matilha_auth_test.')
const prefix = `client-invite-${randomBytes(6).toString('hex')}`
let id = randomBytes(4).readUInt32BE(0) % 1_000_000_000 + 1
const target = () => ({ siggmaCliCod: id++, nome: 'Cliente Teste', telefone: '11999999999', email: `${prefix}-${id}@example.test` })
const passwordHash = '$2b$12$test-only-password-hash'
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } })
  await db.cliente.deleteMany({ where: { email: { startsWith: prefix } } })
  await db.clientInvitation.deleteMany({ where: { email: { startsWith: prefix } } })
  await db.$disconnect()
})
test('guarda apenas hash; ativação cria CLIENTE vinculado e confirma uso', async () => {
  const person = target()
  const { invitation, token } = await issueClientInvitation(person, 'admin-test')
  expect(token).toMatch(/^[a-f0-9]{64}$/)
  expect(invitation.tokenHash).toBe(hashInvitation(token))
  expect(JSON.stringify(invitation)).not.toContain(token)
  expect(invitation.expiresAt.getTime() - invitation.issuedAt.getTime()).toBe(48 * 60 * 60_000)
  await acceptClientInvitation(token, passwordHash)
  const user = await db.user.findUnique({ where: { email: person.email } })
  expect(user?.role).toBe('CLIENTE')
  expect(user?.siggmaCliCod).toBe(person.siggmaCliCod)
  expect(user?.clienteId).toBeTruthy()
  expect((await db.clientInvitation.findUnique({ where: { id: invitation.id } }))?.usedAt).not.toBeNull()
  await expect(acceptClientInvitation(token, 'replacement')).rejects.toThrow()
  expect((await db.user.findUnique({ where: { email: person.email } }))?.senha).toBe(passwordHash)
})
test('expirado, revogado e token inválido não criam conta', async () => {
  for (const state of ['expired', 'revoked']) {
    const person = target()
    const { invitation, token } = await issueClientInvitation(person, 'admin-test')
    await db.clientInvitation.update({ where: { id: invitation.id }, data: state === 'expired' ? { expiresAt: new Date(0) } : { revokedAt: new Date() } })
    await expect(acceptClientInvitation(token, passwordHash)).rejects.toThrow()
    expect(await db.user.findUnique({ where: { email: person.email } })).toBeNull()
  }
  await expect(acceptClientInvitation('0'.repeat(64), passwordHash)).rejects.toThrow()
})
test('ativações concorrentes consomem o convite uma única vez', async () => {
  const person = target()
  const { token } = await issueClientInvitation(person, 'admin-test')
  const results = await Promise.allSettled([acceptClientInvitation(token, passwordHash), acceptClientInvitation(token, passwordHash)])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(await db.user.count({ where: { email: person.email } })).toBe(1)
  expect(await db.cliente.count({ where: { email: person.email } })).toBe(1)
})
test('reenvio invalida link anterior e limita envios consecutivos', async () => {
  const person = target()
  const first = await issueClientInvitation(person, 'admin-test')
  await expect(issueClientInvitation(person, 'admin-test')).rejects.toThrow()
  await db.clientInvitation.update({ where: { id: first.invitation.id }, data: { issuedAt: new Date(Date.now() - 61_000) } })
  const second = await issueClientInvitation(person, 'admin-test')
  await expect(acceptClientInvitation(first.token, passwordHash)).rejects.toThrow()
  await acceptClientInvitation(second.token, passwordHash)
})
test('não altera conta existente nem consome convite em conflito', async () => {
  const person = target()
  const { invitation, token } = await issueClientInvitation(person, 'admin-test')
  await db.user.create({ data: { nome: 'Original', email: person.email.toUpperCase(), senha: 'original', role: 'ADMIN' } })
  await expect(acceptClientInvitation(token, passwordHash)).rejects.toThrow()
  expect((await db.clientInvitation.findUnique({ where: { id: invitation.id } }))?.usedAt).toBeNull()
  expect((await db.user.findFirst({ where: { email: { equals: person.email, mode: 'insensitive' } } }))?.senha).toBe('original')
  await expect(issueClientInvitation(person, 'admin-test')).rejects.toThrow()
  await db.user.deleteMany({ where: { email: person.email.toUpperCase() } })
})
test('não associa prontuário local apenas pelo e-mail', async () => {
  const person = target()
  await db.cliente.create({ data: { nome: 'Original', email: person.email, telefone: '1111111111' } })
  await expect(issueClientInvitation(person, 'admin-test')).rejects.toThrow()
  expect((await db.cliente.findUnique({ where: { email: person.email } }))?.nome).toBe('Original')
})
test('envio é individual, tem link sem token na query e não expõe senha', async () => {
  const originalFetch = globalThis.fetch
  const old = { key: process.env.RESEND_API_KEY, from: process.env.INVITATION_EMAIL_FROM, url: process.env.APP_URL }
  process.env.RESEND_API_KEY = 'test-key'
  process.env.INVITATION_EMAIL_FROM = 'Matilha <teste@example.test>'
  process.env.APP_URL = 'https://example.test'
  let sent: Record<string, unknown> = {}
  globalThis.fetch = Object.assign(async (_url: unknown, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body))
    return Response.json({ id: 'fake-email-id' })
  }, { preconnect: originalFetch.preconnect }) as typeof fetch
  try {
    const person = target()
    const token = randomBytes(32).toString('hex')
    expect(await sendClientInvitation({ ...person, tokenHash: hashInvitation(token) }, token)).toBe('fake-email-id')
    expect(sent.to).toEqual([person.email])
    expect(sent.text).toContain(`/ativar-conta#convite=${token}`)
    expect(sent.text).not.toContain(passwordHash)
    process.env.APP_URL = 'http://example.test'
    expect(invitationMailConfig().configured).toBe(false)
  } finally {
    globalThis.fetch = originalFetch
    for (const [name, value] of Object.entries({ RESEND_API_KEY: old.key, INVITATION_EMAIL_FROM: old.from, APP_URL: old.url })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value
    }
  }
})
