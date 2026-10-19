import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const usuario = await getUsuarioLogado()
  if (!usuario?.cliente) return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })
  try {
    const agendamentos = await db.agendamento.findMany({
      where: { clienteId: usuario.cliente.id },
      orderBy: { dataHora: 'asc' },
      include: { pet: true },
    })
    return NextResponse.json(agendamentos, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('cliente/agendamentos GET:', error)
    return NextResponse.json({ error: 'Não foi possível consultar agendamentos.' }, { status: 500 })
  }
}

export async function POST() {
  const usuario = await getUsuarioLogado()
  if (!usuario?.cliente) return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })
  return NextResponse.json(
    { error: 'Agendamento automático indisponível. Solicite o atendimento pelo formulário do portal ou pelo WhatsApp.' },
    { status: 409 }
  )
}
