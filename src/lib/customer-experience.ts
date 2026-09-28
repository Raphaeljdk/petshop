import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { assertSameOrigin, AuthError } from '@/lib/auth-http'
import { db } from '@/lib/db'
import { getZettaProduct, zettaProductStock } from '@/lib/zetta-products'

// Paid online sales or completed counter sales; pending/refunded orders never qualify.
export const paidSaleWhere = {
  status: 'concluida',
  OR: [
    { mercadoPagoStatus: 'approved' },
    { mercadoPagoId: null, mercadoPagoStatus: null },
  ],
} satisfies Prisma.VendaWhereInput

export function experienceError(error: unknown) {
  if (error instanceof AuthError)
    return NextResponse.json({ error: error.message }, { status: error.status })
  if (error instanceof z.ZodError)
    return NextResponse.json(
      { error: error.issues[0]?.message || 'Dados inválidos.' },
      { status: 400 },
    )
  if (error instanceof SyntaxError)
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P2021', 'P2022'].includes(error.code)
  ) {
    return NextResponse.json(
      {
        error:
          'Este recurso ainda está em preparação. Tente novamente mais tarde.',
        code: 'SETUP_REQUIRED',
      },
      { status: 503 },
    )
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P2002', 'P2034'].includes(error.code)
  ) {
    return NextResponse.json(
      {
        error:
          'A solicitação já existe ou foi atualizada. Atualize a página antes de tentar novamente.',
      },
      { status: 409 },
    )
  }
  console.error('[customer-experience]', error)
  return NextResponse.json(
    { error: 'Não foi possível concluir. Tente novamente.' },
    { status: 500 },
  )
}

export async function experienceBody(
  req: NextRequest,
  limit = 16384,
): Promise<unknown> {
  assertSameOrigin(req)
  if (!req.headers.get('content-type')?.startsWith('application/json'))
    throw new AuthError('Envie JSON.', 415)
  const raw = await req.text()
  if (new TextEncoder().encode(raw).length > limit)
    throw new AuthError('Dados muito grandes.', 413)
  return JSON.parse(raw)
}

export async function preferencesFor(clienteId: string) {
  const rows = await db.customerPreference.findMany({
    where: { clienteId },
    include: { produto: true },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
  return Promise.all(
    rows.map(async ({ produto, ...row }) => {
      let available: boolean | null = produto.ativo && produto.estoque > 0
      if (row.restock && produto.zettaProCod) {
        try {
          const official = await getZettaProduct(produto.zettaProCod)
          available = !official.excluido && zettaProductStock(official) > 0
        } catch {
          available = null
        }
      }
      return {
        ...row,
        product: {
          id: produto.id,
          nome: produto.nome,
          imageUrl: produto.imageUrl,
          ativo: produto.ativo,
        },
        available,
      }
    }),
  )
}

export async function loyaltyBalance(
  client: Prisma.TransactionClient,
  clienteId: string,
) {
  const config = await client.loyaltyConfig.findUnique({
    where: { id: 'default' },
  })
  if (!config)
    return { config: null, earned: 0, used: 0, balance: 0, redemptions: [] }
  const [sales, redemptions] = await Promise.all([
    client.venda.findMany({
      where: {
        ...paidSaleWhere,
        clienteId,
        createdAt: { gte: config.startsAt },
      },
      select: { total: true, valorFrete: true },
    }),
    client.loyaltyRedemption.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  const earned = sales.reduce(
    (sum, sale) =>
      sum +
      Math.floor(
        Math.max(0, Math.round((sale.total - (sale.valorFrete || 0)) * 100)) /
          config.spendCentsPerPoint,
      ),
    0,
  )
  const used = redemptions.reduce(
    (sum, redemption) => sum + redemption.points,
    0,
  )
  return { config, earned, used, balance: earned - used, redemptions }
}

export const preferenceInput = z
  .object({
    produtoId: z.string().min(1).max(100),
    favorite: z.boolean().optional(),
    restock: z.boolean().optional(),
    reminderAt: z.string().datetime().nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.favorite !== undefined ||
      value.restock !== undefined ||
      value.reminderAt !== undefined,
    'Escolha uma preferência.',
  )

export const reviewInput = z
  .object({
    produtoId: z.string().min(1).max(100),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(3).max(1000),
  })
  .strict()

export const petProfileInput = z
  .object({
    petKey: z.string().min(1).max(100),
    photo: z
      .string()
      .max(400000)
      .regex(
        /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/,
        'Envie uma foto JPEG, PNG ou WebP.',
      )
      .nullable(),
    size: z.enum(['pequeno', 'medio', 'grande', 'gigante']).nullable(),
    birthday: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((s) => {
        const d = new Date(s + 'T00:00:00Z')
        return (
          !Number.isNaN(d.getTime()) &&
          d.toISOString().slice(0, 10) === s &&
          d <= new Date() &&
          d.getUTCFullYear() >= 1970
        )
      }, 'Data de nascimento inválida.')
      .nullable(),
    notes: z.string().trim().max(2000).nullable(),
  })
  .strict()
