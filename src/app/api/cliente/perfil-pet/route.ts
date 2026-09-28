import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { getZettaAnimalsByClient } from '@/lib/zetta-client'
import {
  experienceBody,
  experienceError,
  petProfileInput,
} from '@/lib/customer-experience'

export async function GET() {
  try {
    const user = await getUsuarioLogado()
    if (!user?.cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json(
      await db.customerPetProfile.findMany({
        where: { clienteId: user.cliente.id },
      }),
    )
  } catch (error) {
    return experienceError(error)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getUsuarioLogado()
    if (!user?.cliente)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { petKey, ...data } = petProfileInput.parse(
      await experienceBody(req, 410000),
    )
    const owned = user.siggmaCliCod
      ? (await getZettaAnimalsByClient(user.siggmaCliCod)).some(
          (pet) => `zetta:${pet.id}` === petKey,
        )
      : Boolean(
          await db.pet.findFirst({
            where: { id: petKey, clienteId: user.cliente.id },
          }),
        )
    if (!owned)
      return NextResponse.json({ error: 'Pet não encontrado' }, { status: 404 })
    return NextResponse.json(
      await db.customerPetProfile.upsert({
        where: { clienteId_petKey: { clienteId: user.cliente.id, petKey } },
        create: { clienteId: user.cliente.id, petKey, ...data },
        update: data,
      }),
    )
  } catch (error) {
    return experienceError(error)
  }
}
