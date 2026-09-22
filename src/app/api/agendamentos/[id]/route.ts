import { NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'

async function readOnlyResponse() {
  const usuario = await getUsuarioLogado()
  if (!usuario) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (usuario.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  return NextResponse.json(
    {
      error: 'A agenda oficial do Siggma está disponível somente para leitura pela integração. Alterações devem ser feitas diretamente no Siggma.',
    },
    { status: 405, headers: { Allow: 'GET' } }
  )
}

export async function PATCH() {
  return readOnlyResponse()
}

export async function DELETE() {
  return readOnlyResponse()
}
