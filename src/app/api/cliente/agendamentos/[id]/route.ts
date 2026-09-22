import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { getSiggmaAgendaItemId } from '@/lib/siggma/agendamentos'
import { SiggmaApiError } from '@/lib/siggma/client'
import { SiggmaConfigurationError } from '@/lib/siggma/config'
import { siggma } from '@/lib/siggma/service'

function parseAppointmentId(value: string) {
  const raw = value.startsWith('siggma:') ? value.slice('siggma:'.length) : value
  const id = Number.parseInt(raw, 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

async function isCancelableForClient(id: number, cliCod: number) {
  let page = 1
  let pages = 1
  do {
    const response = await siggma.agendamentos.consultar({ cliente: cliCod, status: 'novo', pagina: page })
    if (response.data.some((item) => getSiggmaAgendaItemId(item) === id)) return true
    pages = Math.min(Math.max(Number(response.metadata?.paginas || 1), 1), 50)
    page += 1
  } while (page <= pages)
  return false
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario || !usuario.cliente) return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })
    if (!usuario.siggmaCliCod) return NextResponse.json({ error: 'Cancelamento por esta rota é exclusivo de agendamentos Siggma.' }, { status: 409 })

    const { id: rawId } = await params
    const id = parseAppointmentId(rawId)
    if (!id) return NextResponse.json({ error: 'Agendamento inválido' }, { status: 400 })

    const cancelavel = await isCancelableForClient(id, usuario.siggmaCliCod)
    if (!cancelavel) return NextResponse.json({ error: 'Agendamento não encontrado para este cliente ou não pode mais ser cancelado.' }, { status: 409 })

    return NextResponse.json(await siggma.agendamentos.cancelar(id))
  } catch (error) {
    console.error('cliente/agendamentos/[id] DELETE erro:', error)
    if (error instanceof SiggmaConfigurationError) return NextResponse.json({ error: 'Integração Siggma não configurada.', missing: error.missing }, { status: 503 })
    if (error instanceof SiggmaApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status })
    return NextResponse.json({ error: 'Erro ao cancelar agendamento' }, { status: 500 })
  }
}
