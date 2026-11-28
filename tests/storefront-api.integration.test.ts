import { afterAll, beforeAll, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { db } from '../src/lib/db'
import { GET as catalog } from '../src/app/api/public/produtos/route'
import { GET as blog } from '../src/app/api/public/blog/route'
import { GET as info } from '../src/app/api/public/vitrine/route'
if (!/\/matilha_auth_test\b/.test(process.env.DATABASE_URL || ''))
  throw new Error('Utilize o banco isolado matilha_auth_test.')
const prefix = 'vitrine-qa-' + randomUUID()
const item = (suffix: string) => ({
  nome: prefix + suffix,
  categoria: 'Brinquedos',
  estoque: 5,
  estoqueHub: 5,
  preco: 90,
})
const rows: string[] = [],
  sales: string[] = []
beforeAll(async () => {
  for (const suffix of [' Pago', ' Pendente'])
    rows.push((await db.produto.create({ data: item(suffix) })).id)
  for (const [i, status] of ['concluida', 'pendente'].entries())
    sales.push(
      (
        await db.venda.create({
          data: {
            total: 90,
            status,
            itens: { create: { produtoId: rows[i], quantidade: i ? 90 : 2, precoUnit: 45 } },
          },
        })
      ).id,
    )
  for (const published of [true, false])
    await db.portalArticle.create({
      data: {
        title: prefix + published,
        body: 'Editorial',
        summary: 'QA',
        category: 'Banho',
        published,
      },
    })
  await db.portalPetMemory.create({
    data: {
      clienteId: prefix,
      petKey: prefix,
      kind: 'diario',
      title: prefix + 'Relato privado',
      blogConsentAt: new Date(),
      blogStatus: 'publicado',
    },
  })
  for (const active of [true, false])
    await db.portalCarePlan.create({
      data: { title: prefix + active, description: 'Condição', priceCents: 9000, sessions: 2, active },
    })
})
afterAll(async () => {
  await db.venda.deleteMany({ where: { id: { in: sales } } })
  await db.produto.deleteMany({ where: { id: { in: rows } } })
  await db.portalArticle.deleteMany({ where: { title: { startsWith: prefix } } })
  await db.portalCarePlan.deleteMany({ where: { title: { startsWith: prefix } } })
  await db.portalPetMemory.deleteMany({ where: { clienteId: prefix } })
})
test('ranking exclui pedidos pendentes e omite campos operacionais', async () => {
  const response = await catalog()
  expect(response.status).toBe(200)
  const all = await response.json()
  const paid = all.find((r: { id: string }) => r.id === rows[0])
  expect(paid.bestSellerRank).toBeGreaterThan(0)
  expect(all.find((r: { id: string }) => r.id === rows[1]).bestSellerRank).toBeUndefined()
  expect(paid).not.toHaveProperty('estoqueHub')
  expect(paid).not.toHaveProperty('itens')
  expect(paid.createdAt).toBeTruthy()
})
test('blog público exclui rascunhos e diários cujo aceite é restrito ao portal', async () => {
  const { articles } = await (await blog()).json()
  expect(
    articles
      .filter((a: { title: string }) => a.title.startsWith(prefix))
      .map((a: { title: string }) => a.title),
  ).toEqual([prefix + 'true'])
})
test('planos públicos ativos não expõem dados de contratação', async () => {
  const { plans, coupons } = await (await info()).json()
  expect(
    plans
      .filter((a: { title: string }) => a.title.startsWith(prefix))
      .map((a: { title: string }) => a.title),
  ).toEqual([prefix + 'true'])
  expect(plans[0]).not.toHaveProperty('requests')
  expect(coupons).toEqual([])
})
