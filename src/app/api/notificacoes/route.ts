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

    const notificacoes = await db.notificacao.findMany({
      orderBy: { createdAt: 'desc' },
      include: { processo: { include: { pet: true } } },
    })

    return NextResponse.json(notificacoes)
  } catch (e) {
    console.error('notificacoes GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar notificações' }, { status: 500 })
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
    const { tipo, destino, mensagem, processoId } = body

    if (!tipo || !destino || !mensagem) {
      return NextResponse.json(
        { error: 'tipo, destino e mensagem são obrigatórios' },
        { status: 400 }
      )
    }

    const notificacao = await db.notificacao.create({
      data: {
        tipo,
        destino,
        mensagem,
        processoId: processoId || null,
      },
      include: { processo: { include: { pet: true } } },
    })

    return NextResponse.json(notificacao, { status: 201 })
  } catch (e) {
    console.error('notificacoes POST erro:', e)
    return NextResponse.json({ error: 'Erro ao criar notificação' }, { status: 500 })
  }
}
