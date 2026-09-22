import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { listOfficialAgenda } from '@/lib/siggma/agendamentos'
import { SiggmaApiError } from '@/lib/siggma/client'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (usuario.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    const url = new URL(req.url)
    const dataInicial = url.searchParams.get('dataInicial') || today()
    const dataFinal = url.searchParams.get('dataFinal') || undefined
    const status = url.searchParams.get('status') || undefined
    const tipo = url.searchParams.get('tipo') || undefined

    const agenda = await listOfficialAgenda({
      dataInicial,
      dataFinal,
      status,
      tipo,
    })

    return NextResponse.json(agenda, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('agendamentos GET Siggma erro:', error)
    if (error instanceof SiggmaApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      )
    }
    return NextResponse.json({ error: 'Erro ao consultar agenda oficial do Siggma' }, { status: 500 })
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'A API oficial do Siggma disponibiliza a agenda em modo de leitura. Novos agendamentos devem ser registrados no Siggma pela equipe da Matilha Prado.',
    },
    { status: 405, headers: { Allow: 'GET' } }
  )
}
