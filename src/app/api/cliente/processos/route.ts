import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'

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

    const processos = await db.processo.findMany({
      where: { pet: { clienteId: cliente.id } },
      orderBy: { createdAt: 'desc' },
      include: { pet: true, notificacoes: true },
    })

    return NextResponse.json(
      processos.map((processo) => ({ ...processo, origem: 'local' as const }))
    )
  } catch (e) {
    console.error('cliente/processos GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar processos' }, { status: 500 })
  }
}
