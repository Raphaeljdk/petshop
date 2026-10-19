import { NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'

export async function POST() {
  const usuario = await getUsuarioLogado()
  if (!usuario) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (usuario.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  return NextResponse.json(
    { error: 'O Zetta foi desvinculado da Matilha Prado. Utilize o ERP próprio.' },
    { status: 410 }
  )
}
