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
type Params = { params: Promise<{ id: string; petId: string }> }
export async function PUT(req: NextRequest, { params }: Params) {
  const denied = await checkAdmin()
  if (denied) return denied
  try {
    assertSameOrigin(req)
    const { id, petId } = await params
    const existing = await db.pet.findFirst({ where: { id: petId, clienteId: id, ativo: true }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Pet não encontrado.' }, { status: 404 })
    const data = petInputSchema.parse(await req.json())
    return NextResponse.json(await db.pet.update({ where: { id: petId }, data }))
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 })
    console.error('cliente pet PUT:', e)
    return NextResponse.json({ error: 'Erro ao editar pet.' }, { status: 500 })
  }
}
export async function DELETE(req: NextRequest, { params }: Params) {
  const denied = await checkAdmin()
  if (denied) return denied
  try {
    assertSameOrigin(req)
    const { id, petId } = await params
    const result = await db.pet.updateMany({ where: { id: petId, clienteId: id, ativo: true }, data: { ativo: false } })
    if (!result.count) return NextResponse.json({ error: 'Pet não encontrado.' }, { status: 404 })
    return NextResponse.json({ success: true, modo: 'inativado' })
  } catch (e) {
    console.error('cliente pet DELETE:', e)
    return NextResponse.json({ error: 'Erro ao remover pet do cadastro.' }, { status: 500 })
  }
}
