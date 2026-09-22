import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { getSiggmaSchedulingConfig, SiggmaConfigurationError } from '@/lib/siggma/config'
import { SiggmaApiError } from '@/lib/siggma/client'
import { siggma } from '@/lib/siggma/service'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario || !usuario.cliente) return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })
    if (!usuario.siggmaCliCod) return NextResponse.json({ error: 'Disponibilidade Siggma disponível apenas para contas vinculadas ao ERP.' }, { status: 409 })

    const inicio = req.nextUrl.searchParams.get('inicio')?.trim() || ''
    const fim = req.nextUrl.searchParams.get('fim')?.trim() || inicio
    if (!DATE_RE.test(inicio) || !DATE_RE.test(fim)) return NextResponse.json({ error: 'Informe inicio e fim no formato YYYY-MM-DD.' }, { status: 400 })

    const { expedienteId } = getSiggmaSchedulingConfig()
    return NextResponse.json(await siggma.agendamentos.horarios(expedienteId, { inicio, fim }))
  } catch (error) {
    console.error('cliente/agendamentos/horarios GET erro:', error)
    if (error instanceof SiggmaConfigurationError) return NextResponse.json({ error: 'Agendamento Siggma ainda não está totalmente configurado.', missing: error.missing }, { status: 503 })
    if (error instanceof SiggmaApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status })
    return NextResponse.json({ error: 'Erro ao consultar horários disponíveis' }, { status: 500 })
  }
}
