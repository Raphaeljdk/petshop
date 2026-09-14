import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params
    const pet = await db.pet.findUnique({
      where: { id },
      include: { cliente: true, processos: true, agendamentos: true },
    })

    if (!pet) {
      return NextResponse.json({ error: 'Pet não encontrado' }, { status: 404 })
    }

    return NextResponse.json(pet)
  } catch (e) {
    console.error('pet GET erro:', e)
    return NextResponse.json({ error: 'Erro ao buscar pet' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { nome, especie, raca, idade, peso, fotoUrl, observacoes, clienteId } = body

    const petExistente = await db.pet.findUnique({ where: { id } })
    if (!petExistente) {
      return NextResponse.json({ error: 'Pet não encontrado' }, { status: 404 })
    }

    const pet = await db.pet.update({
      where: { id },
      data: {
        nome,
        especie,
        raca: raca ?? null,
        idade: idade ?? null,
        peso: peso ?? null,
        fotoUrl: fotoUrl ?? null,
        observacoes: observacoes ?? null,
        clienteId,
      },
      include: { cliente: true },
    })

    return NextResponse.json(pet)
  } catch (e) {
    console.error('pet PUT erro:', e)
    return NextResponse.json({ error: 'Erro ao atualizar pet' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params
    const petExistente = await db.pet.findUnique({ where: { id } })
    if (!petExistente) {
      return NextResponse.json({ error: 'Pet não encontrado' }, { status: 404 })
    }

    await db.pet.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('pet DELETE erro:', e)
    return NextResponse.json({ error: 'Erro ao deletar pet' }, { status: 500 })
  }
}
