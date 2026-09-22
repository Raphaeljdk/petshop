import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      error: 'A consulta de serviços para criação de agendamentos ainda não faz parte da API oficial do Siggma.',
    },
    { status: 410 }
  )
}
