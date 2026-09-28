import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { getZettaAnimalsByClient } from '@/lib/zetta-client'
import { experienceBody, experienceError } from '@/lib/customer-experience'
import { assertSameOrigin } from '@/lib/auth-http'

export async function GET() {
  try {
    const user = await getUsuarioLogado()
    if (!user?.cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json(
      await db.bookingRequest.findMany({
        where: { clienteId: user.cliente.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    )
  } catch (error) {
    return experienceError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUsuarioLogado()
    if (!user?.cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const input = z
      .object({
        petKey: z.string().min(1).max(100),
        service: z.string().trim().min(3).max(120),
        desiredAt: z.string().datetime(),
        notes: z.string().trim().max(1000).optional(),
      })
      .strict()
      .parse(await experienceBody(req))
    const desired = new Date(input.desiredAt)
    if (
      desired.getTime() <= Date.now() ||
      desired.getTime() > Date.now() + 180 * 86400000
    )
      return NextResponse.json(
        { error: 'Escolha uma data futura nos próximos seis meses.' },
        { status: 400 },
      )
    const pet = user.siggmaCliCod
      ? (await getZettaAnimalsByClient(user.siggmaCliCod)).find(
          (p) => `zetta:${p.id}` === input.petKey,
        )
      : await db.pet.findFirst({
          where: { id: input.petKey, clienteId: user.cliente.id },
        })
    if (!pet)
      return NextResponse.json({ error: 'Pet não encontrado' }, { status: 404 })
    const booking = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.cliente!.id}))`
      if (
        (await tx.bookingRequest.count({
          where: { clienteId: user.cliente!.id, status: 'solicitado' },
        })) >= 5
      )
        return null
      return tx.bookingRequest.create({
        data: {
          ...input,
          desiredAt: desired,
          clienteId: user.cliente!.id,
          petName: pet.nome,
        },
      })
    })
    if (!booking)
      return NextResponse.json(
        { error: 'Você já tem cinco solicitações aguardando resposta.' },
        { status: 409 },
      )
    return NextResponse.json(booking, { status: 201 })
  } catch (error) {
    return experienceError(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req)
    const user = await getUsuarioLogado()
    if (!user?.cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const id = z
      .string()
      .min(1)
      .max(100)
      .parse(req.nextUrl.searchParams.get('id'))
    const result = await db.bookingRequest.updateMany({
      where: { id, clienteId: user.cliente.id, status: 'solicitado' },
      data: { status: 'cancelado' },
    })
    if (!result.count)
      return NextResponse.json(
        {
          error:
            'Solicitação não encontrada ou já respondida. Fale com a loja para alterar uma reserva confirmada.',
        },
        { status: 409 },
      )
    return NextResponse.json({ ok: true })
  } catch (error) {
    return experienceError(error)
  }
}
