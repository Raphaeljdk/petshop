import { NextResponse } from 'next/server'

export async function DELETE() {
  return NextResponse.json(
    {
      error: 'O cancelamento de agendamentos não faz parte da API oficial do Siggma disponível para integração.',
    },
    { status: 405, headers: { Allow: 'GET' } }
  )
}
