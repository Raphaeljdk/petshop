import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json(
    { error: 'Agenda automática indisponível. Envie uma solicitação para confirmação manual da equipe.' },
    { status: 410 }
  )
}
