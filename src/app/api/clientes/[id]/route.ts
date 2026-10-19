import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { clienteInputSchema, clienteValidationError } from '@/lib/cliente-validation'
import { assertSameOrigin } from '@/lib/auth-http'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const usuario = await getUsuarioLogado()
  if (!usuario) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (usuario.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  return null
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    assertSameOrigin(req)
    const { id } = await params
    const existe = await db.cliente.findUnique({ where: { id }, select: { id: true } })
    if (!existe) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    const data = clienteInputSchema.parse(await req.json())
    const cliente = await db.cliente.update({ where: { id }, data })
    return NextResponse.json(cliente)
  } catch (error) {
    const validation = clienteValidationError(error)
    if (validation) return NextResponse.json({ error: validation }, { status: 400 })
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'CPF/CNPJ ou e-mail já cadastrado.' }, { status: 409 })
    }
    console.error('clientes PUT:', error)
    return NextResponse.json({ error: 'Não foi possível atualizar o cliente.' }, { status: 500 })
  }
}


/** Exclusão lógica: mantém vendas, documentos fiscais, pets e atendimentos intactos. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    assertSameOrigin(req)
    const { id } = await params
    const cliente = await db.cliente.findUnique({ where: { id }, select: { id: true, ativo: true } })
    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    await db.cliente.update({ where: { id }, data: { ativo: false } })
    return NextResponse.json({ success: true, modo: 'inativado', aviso: 'Cadastro oculto sem apagar vendas ou histórico.' })
  } catch (e) {
    console.error('clientes DELETE:', e)
    return NextResponse.json({ error: 'Não foi possível desativar o cadastro.' }, { status: 500 })
  }
}
