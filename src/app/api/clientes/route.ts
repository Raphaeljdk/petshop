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

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const clientes = await db.cliente.findMany({
      orderBy: { nome: 'asc' },
      include: {
        pets: { select: { id: true, nome: true, especie: true } },
        _count: { select: { vendas: true, pets: true } },
      },
    })
    return NextResponse.json(clientes)
  } catch (error) {
    console.error('clientes GET:', error)
    return NextResponse.json({ error: 'Erro ao listar clientes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied
  try {
    const data = clienteInputSchema.parse(await req.json())
    const cliente = await db.cliente.create({ data })
    return NextResponse.json(cliente, { status: 201 })
  } catch (error) {
    const validation = clienteValidationError(error)
    if (validation) return NextResponse.json({ error: validation }, { status: 400 })
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'CPF/CNPJ ou e-mail já cadastrado.' }, { status: 409 })
    }
    console.error('clientes POST:', error)
    return NextResponse.json({ error: 'Não foi possível cadastrar o cliente.' }, { status: 500 })
  }
}
