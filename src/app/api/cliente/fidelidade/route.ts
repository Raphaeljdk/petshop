import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/auth-http'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'
import { experienceError, loyaltyBalance } from '@/lib/customer-experience'

export async function GET() {
  try {
    const cliente = await getClienteLogado()
    if (!cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json(await loyaltyBalance(db, cliente.id), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    return experienceError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req)
    const cliente = await getClienteLogado()
    if (!cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const result = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cliente.id}))`
        const { config, balance } = await loyaltyBalance(tx, cliente.id)
        if (!config?.active || balance < config.rewardPoints) return null
        const code = 'CLUBE-' + randomBytes(8).toString('hex').toUpperCase()
        await tx.cupom.create({
          data: {
            codigo: code,
            descricao: 'Resgate do Clube Matilha',
            tipoDesconto: 'fixo',
            valor: config.rewardCents / 100,
            valorMinimo: config.rewardCents / 100 + 1,
            limiteUsos: 1,
            limitePorCliente: 1,
            fimEm: new Date(Date.now() + 90 * 86400000),
          },
        })
        return tx.loyaltyRedemption.create({
          data: {
            clienteId: cliente.id,
            points: config.rewardPoints,
            couponCode: code,
          },
        })
      },
      { isolationLevel: 'Serializable' },
    )
    if (!result)
      return NextResponse.json(
        { error: 'Programa inativo ou pontos insuficientes.' },
        { status: 409 },
      )
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return experienceError(error)
  }
}
