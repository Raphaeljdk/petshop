import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { emitWebSocket } from '@/lib/realtime'

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
    const processo = await db.processo.findUnique({
      where: { id },
      include: { pet: { include: { cliente: true } }, notificacoes: true },
    })

    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    return NextResponse.json(processo)
  } catch (e) {
    console.error('processo GET erro:', e)
    return NextResponse.json({ error: 'Erro ao buscar processo' }, { status: 500 })
  }
}

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
    const { status, anamnese, responsavel, valorServico, inicioAtendimento, fimAtendimento } = body

    const processoExistente = await db.processo.findUnique({
      where: { id },
      include: { pet: { include: { cliente: true } } },
    })
    if (!processoExistente) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    const dadosAtualizacao: any = {}
    if (status !== undefined) dadosAtualizacao.status = status
    if (anamnese !== undefined) dadosAtualizacao.anamnese = anamnese
    if (responsavel !== undefined) dadosAtualizacao.responsavel = responsavel
    if (valorServico !== undefined) dadosAtualizacao.valorServico = valorServico
    if (inicioAtendimento !== undefined) dadosAtualizacao.inicioAtendimento = inicioAtendimento
    if (fimAtendimento !== undefined) dadosAtualizacao.fimAtendimento = fimAtendimento

    const processo = await db.processo.update({
      where: { id },
      data: dadosAtualizacao,
      include: { pet: { include: { cliente: true } }, notificacoes: true },
    })

    // Se finalizou o processo, cria notificações SMS + Email
    if (status === 'finalizado' && processoExistente.status !== 'finalizado') {
      const cliente = processo.pet?.cliente
      const destino = cliente?.telefone || cliente?.email || ''
      const mensagem = `Olá ${cliente?.nome || ''}, o serviço "${processo.servico}" para ${processo.pet?.nome || 'seu pet'} foi finalizado. Matilha Prado.`

      await db.notificacao.createMany({
        data: [
          {
            tipo: 'sms',
            destino: cliente?.telefone || '',
            mensagem,
            processoId: processo.id,
          },
          {
            tipo: 'email',
            destino: cliente?.email || '',
            mensagem,
            processoId: processo.id,
          },
        ],
      })

      await db.processo.update({
        where: { id },
        data: { notificadoEm: new Date() },
      })

      await emitWebSocket('processo:finalizado', {
        id: processo.id,
        petNome: processo.pet?.nome,
        clienteNome: cliente?.nome,
      })
      await emitWebSocket('notificacao:nova', {
        processoId: processo.id,
        tipos: ['sms', 'email'],
      })
    } else {
      await emitWebSocket('processo:atualizado', {
        id: processo.id,
        status: processo.status,
      })
    }

    return NextResponse.json(processo)
  } catch (e) {
    console.error('processo PATCH erro:', e)
    return NextResponse.json({ error: 'Erro ao atualizar processo' }, { status: 500 })
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
    const processoExistente = await db.processo.findUnique({ where: { id } })
    if (!processoExistente) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    await db.processo.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('processo DELETE erro:', e)
    return NextResponse.json({ error: 'Erro ao deletar processo' }, { status: 500 })
  }
}
