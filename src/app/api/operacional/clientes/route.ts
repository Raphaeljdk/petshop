import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { isOperationalOperator } from '@/lib/operational-access'

export const dynamic = 'force-dynamic'

// Pesquisa limitada a tutor e pets ativos; nunca retorna CPF, documentos ou informações financeiras.
export async function GET(req: NextRequest) {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!isOperationalOperator(user)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  const busca = req.nextUrl.searchParams.get('busca')?.trim() || ''
  if (busca.length < 2 || busca.length > 80) {
    return NextResponse.json({ items: [] }, { headers: { 'Cache-Control': 'private, no-store' } })
  }
  try {
    const items = await db.cliente.findMany({
      where: { ativo: true, nome: { contains: busca, mode: 'insensitive' } },
      orderBy: { nome: 'asc' },
      take: 40,
      select: {
        id: true, nome: true,
        pets: { where: { ativo: true }, select: { id: true, nome: true, especie: true }, orderBy: { nome: 'asc' } },
      },
    })
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[operacional/clientes] falha:', error)
    return NextResponse.json({ error: 'Não foi possível buscar tutores.' }, { status: 500 })
  }
}
