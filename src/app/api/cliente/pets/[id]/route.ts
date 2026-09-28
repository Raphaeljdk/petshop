import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { experienceBody, experienceError } from '@/lib/customer-experience'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUsuarioLogado()
    if (!user?.cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (user.siggmaCliCod)
      return NextResponse.json(
        { error: 'Para alterar o cadastro oficial, fale com a loja.' },
        { status: 409 },
      )
    const { id } = await params
    const data = z
      .object({
        nome: z.string().trim().min(1).max(100),
        especie: z.string().trim().min(1).max(50),
        raca: z.string().max(100).nullable(),
        idade: z.string().max(50).nullable(),
        peso: z.string().max(30).nullable(),
      })
      .strict()
      .parse(await experienceBody(req))
    const result = await db.pet.updateMany({
      where: { id, clienteId: user.cliente.id },
      data,
    })
    if (!result.count)
      return NextResponse.json({ error: 'Pet não encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return experienceError(error)
  }
}
