import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-helpers'
import { consultarCatalogoPublico } from '@/lib/catalogo-agenda-publica'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const base = { configured: false, writeConfigured: false, services: [], missing: [], fallback: 'solicitacao-equipe' }
  const headers = { 'Cache-Control': 'private, no-store' }
  const petKey = req.nextUrl.searchParams.get('petKey')
  const quando = req.nextUrl.searchParams.get('quando')
  if (!petKey) return NextResponse.json(base, { headers })
  try {
    const user = await getUsuarioLogado()
    if (!user?.cliente) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401, headers })
    const pet = await db.pet.findFirst({ where: { id: petKey, clienteId: user.cliente.id, ativo: true }, select: { raca: true } })
    if (!pet) return NextResponse.json({ error: 'Pet não encontrado.' }, { status: 404, headers })
    const data = quando ? new Date(quando) : undefined
    if (data && (!Number.isFinite(data.getTime()) || data.getTime() <= Date.now() || data.getTime() > Date.now() + 180 * 86400000))
      return NextResponse.json({ error: 'Escolha uma data futura nos próximos seis meses.' }, { status: 400, headers })
    return NextResponse.json({ ...base, raca:pet.raca, catalogo: await consultarCatalogoPublico(pet.raca, data) }, { headers })
  } catch (error) {
    console.error('catalogo de agenda do cliente', error)
    return NextResponse.json({ error: 'Não foi possível consultar a disponibilidade.' }, { status: 500, headers })
  }
}
