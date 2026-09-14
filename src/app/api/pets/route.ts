import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const pets = await db.pet.findMany({
      orderBy: { createdAt: 'desc' },
      include: { cliente: true },
    })

    return NextResponse.json(pets)
  } catch (e) {
    console.error('pets GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar pets' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await req.json()
    const { nome, especie, raca, idade, peso, fotoUrl, observacoes, clienteId } = body

    if (!nome || !especie || !clienteId) {
      return NextResponse.json(
        { error: 'Nome, espécie e clienteId são obrigatórios' },
        { status: 400 }
      )
    }

    const clienteExiste = await db.cliente.findUnique({ where: { id: clienteId } })
    if (!clienteExiste) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
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
        clienteId,
      },
      include: { cliente: true },
    })

    return NextResponse.json(pet, { status: 201 })
  } catch (e) {
    console.error('pets POST erro:', e)
    return NextResponse.json({ error: 'Erro ao criar pet' }, { status: 500 })
  }
}
