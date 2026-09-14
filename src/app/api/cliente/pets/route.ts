import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const cliente = await getClienteLogado()
    if (!cliente) {
      return NextResponse.json(
        { error: 'Cliente não autenticado' },
        { status: 401 }
      )
    }

    const pets = await db.pet.findMany({
      where: { clienteId: cliente.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(pets)
  } catch (e) {
    console.error('cliente/pets GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar pets' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const cliente = await getClienteLogado()
    if (!cliente) {
      return NextResponse.json(
        { error: 'Cliente não autenticado' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { nome, especie, raca, idade, peso, fotoUrl, observacoes } = body

    if (!nome || !especie) {
      return NextResponse.json(
        { error: 'nome e especie são obrigatórios' },
        { status: 400 }
      )
    }

    const pet = await db.pet.create({
      data: {
        nome,
        especie,
        raca: raca || null,
        idade: idade || null,
        peso: peso || null,
        fotoUrl: fotoUrl || null,
        observacoes: observacoes || null,
        clienteId: cliente.id,
      },
      include: { cliente: true },
    })

    return NextResponse.json(pet, { status: 201 })
  } catch (e) {
    console.error('cliente/pets POST erro:', e)
    return NextResponse.json({ error: 'Erro ao criar pet' }, { status: 500 })
  }
}
