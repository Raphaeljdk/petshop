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

    const integracoes = await db.integracao.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(integracoes)
  } catch (e) {
    console.error('integracoes GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar integrações' }, { status: 500 })
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
    const { plataforma, token, sellerId, domain, ativo } = body

    if (!plataforma) {
      return NextResponse.json(
        { error: 'plataforma é obrigatória' },
        { status: 400 }
      )
    }

    const integracao = await db.integracao.create({
      data: {
        plataforma,
        token: token || null,
        sellerId: sellerId || null,
        domain: domain || null,
        ativo: ativo !== undefined ? Boolean(ativo) : false,
      },
    })

    // Simula sincronização
    if (integracao.ativo) {
      const atualizada = await db.integracao.update({
        where: { id: integracao.id },
        data: { ultimaSync: new Date() },
      })

      await emitWebSocket('integracao:sincronizada', {
        id: atualizada.id,
        plataforma: atualizada.plataforma,
        ultimaSync: atualizada.ultimaSync,
      })

      return NextResponse.json(atualizada, { status: 201 })
    }

    return NextResponse.json(integracao, { status: 201 })
  } catch (e) {
    console.error('integracoes POST erro:', e)
    return NextResponse.json({ error: 'Erro ao criar integração' }, { status: 500 })
  }
}
