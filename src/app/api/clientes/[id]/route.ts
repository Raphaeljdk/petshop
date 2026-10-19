import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { clienteInputSchema, clienteValidationError } from '@/lib/cliente-validation'

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

// A exclusão física pode remover vínculos de compras e pets em cascata.
// O ERP não expõe DELETE sem política de retenção aprovada.
export async function DELETE() {
  const denied = await requireAdmin()
  if (denied) return denied
  return NextResponse.json({ error: 'Exclusão bloqueada para preservar o histórico fiscal e comercial.' }, { status: 409 })
}
