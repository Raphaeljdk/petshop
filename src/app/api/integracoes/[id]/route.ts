import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { emitWebSocket } from '@/lib/realtime'

export async function PATCH(
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
    const { ativo, token, sellerId, domain } = body

    const integracaoExistente = await db.integracao.findUnique({ where: { id } })
    if (!integracaoExistente) {
      return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 })
    }
    if (integracaoExistente.plataforma === 'mercado_livre') return NextResponse.json({ error: 'Gerencie o Mercado Livre pelo fluxo OAuth.' }, { status: 400 })

    const dados: any = {}
    if (ativo !== undefined) dados.ativo = Boolean(ativo)
    if (token !== undefined) dados.token = token
    if (sellerId !== undefined) dados.sellerId = sellerId
    if (domain !== undefined) dados.domain = domain

    // Se ativou a integração, simula sincronização
    if (ativo === true) {
      dados.ultimaSync = new Date()
    }

    const integracao = await db.integracao.update({
      where: { id },
      data: dados,
    })

    if (ativo === true) {
      await emitWebSocket('integracao:sincronizada', {
        id: integracao.id,
        plataforma: integracao.plataforma,
        ultimaSync: integracao.ultimaSync,
      })
    }

    return NextResponse.json({ ...integracao, token: undefined })
  } catch (e) {
    console.error('integracao PATCH erro:', e)
    return NextResponse.json({ error: 'Erro ao atualizar integração' }, { status: 500 })
  }
}
