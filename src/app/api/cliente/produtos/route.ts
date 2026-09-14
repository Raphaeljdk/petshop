import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const produtos = await db.produto.findMany({
      where: { ativo: true, estoque: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(produtos)
  } catch (e) {
    console.error('cliente/produtos GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar produtos' }, { status: 500 })
  }
}
