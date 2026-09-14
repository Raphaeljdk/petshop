import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { emitWebSocket } from '@/lib/realtime'

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const processos = await db.processo.findMany({
      orderBy: { createdAt: 'desc' },
      include: { pet: { include: { cliente: true } }, notificacoes: true },
    })

    return NextResponse.json(processos)
  } catch (e) {
    console.error('processos GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar processos' }, { status: 500 })
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
    const { petId, servico, responsavel, anamnese, valorServico, status } = body

    if (!petId || !servico) {
      return NextResponse.json(
        { error: 'petId e servico são obrigatórios' },
        { status: 400 }
      )
    }

    const petExiste = await db.pet.findUnique({ where: { id: petId } })
    if (!petExiste) {
      return NextResponse.json({ error: 'Pet não encontrado' }, { status: 404 })
    }

    const processo = await db.processo.create({
      data: {
        petId,
        servico,
        responsavel: responsavel || null,
        anamnese: anamnese || null,
        valorServico: typeof valorServico === 'number' ? valorServico : 0,
        status: status || 'novo',
      },
      include: { pet: { include: { cliente: true } } },
    })

    await emitWebSocket('processo:novo', {
      id: processo.id,
      petId: processo.petId,
      servico: processo.servico,
      petNome: processo.pet?.nome,
    })

    return NextResponse.json(processo, { status: 201 })
  } catch (e) {
    console.error('processos POST erro:', e)
    return NextResponse.json({ error: 'Erro ao criar processo' }, { status: 500 })
  }
}
