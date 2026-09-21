import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { ageLabel, getZettaAnimalsByClient } from '@/lib/zetta-client'

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    const cliente = usuario?.cliente
    if (!usuario || !cliente) {
      return NextResponse.json(
        { error: 'Cliente não autenticado' },
        { status: 401 }
      )
    }

    if (usuario.siggmaCliCod) {
      const animais = await getZettaAnimalsByClient(usuario.siggmaCliCod)
      const pets = animais.map((animal) => {
        const updatedAt = animal.dataAtualizacao || new Date().toISOString()
        return {
          id: `zetta:${animal.id}`,
          nome: animal.nome,
          especie: animal.especie || 'Pet',
          raca: animal.raca || null,
          idade: ageLabel(animal.dataNascimento),
          peso: animal.peso == null ? null : String(animal.peso),
          fotoUrl: null,
          observacoes: null,
          clienteId: cliente.id,
          createdAt: updatedAt,
          updatedAt,
          origem: 'zetta' as const,
          zettaId: animal.id,
        }
      })
      return NextResponse.json(pets)
    }

    const pets = await db.pet.findMany({
      where: { clienteId: cliente.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(
      pets.map((pet) => ({ ...pet, origem: 'local' as const }))
    )
  } catch (e) {
    console.error('cliente/pets GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar pets' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await getUsuarioLogado()
    const cliente = usuario?.cliente
    if (!usuario || !cliente) {
      return NextResponse.json(
        { error: 'Cliente não autenticado' },
        { status: 401 }
      )
    }

    if (usuario.siggmaCliCod) {
      return NextResponse.json(
        {
          error:
            'Esta conta está vinculada ao Siggma. O cadastro de pets deve ser feito pela equipe no ERP para manter os dados sincronizados.',
        },
        { status: 409 }
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
