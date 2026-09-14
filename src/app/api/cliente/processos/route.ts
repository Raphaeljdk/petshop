import { NextResponse } from 'next/server'
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

    const processos = await db.processo.findMany({
      where: { pet: { clienteId: cliente.id } },
      orderBy: { createdAt: 'desc' },
      include: { pet: true, notificacoes: true },
    })

    return NextResponse.json(processos)
  } catch (e) {
    console.error('cliente/processos GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar processos' }, { status: 500 })
  }
}
