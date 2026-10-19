import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import { petInputSchema } from '@/lib/pet-validation'

async function checkAdmin() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
  return null
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await checkAdmin()
  if (denied) return denied
  try {
    assertSameOrigin(req)
    const { id } = await params
    const cliente = await db.cliente.findUnique({ where: { id }, select: { ativo: true } })
    if (!cliente?.ativo) return NextResponse.json({ error: 'Tutor não encontrado ou inativo.' }, { status: 404 })
    const data = petInputSchema.parse(await req.json())
    const pet = await db.pet.create({ data: { ...data, clienteId: id } })
    return NextResponse.json(pet, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 })
    console.error('cliente pet POST:', e)
    return NextResponse.json({ error: 'Não foi possível adicionar o pet.' }, { status: 500 })
  }
}
