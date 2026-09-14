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

    const vendas = await db.venda.findMany({
      where: { clienteId: cliente.id },
      orderBy: { createdAt: 'desc' },
      include: { itens: { include: { produto: true } } },
    })

    return NextResponse.json(vendas)
  } catch (e) {
    console.error('cliente/compras GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar compras' }, { status: 500 })
  }
}
