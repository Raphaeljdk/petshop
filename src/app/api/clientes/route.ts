import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { clienteInputSchema, clienteValidationError } from '@/lib/cliente-validation'
import { clienteComPetsSchema } from '@/lib/pet-validation'
import { assertSameOrigin } from '@/lib/auth-http'

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
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      include: {
        pets: { where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, especie: true, raca: true, porte: true, sexo: true, nascimento: true, cor: true, castrado: true, observacoes: true, idade: true, peso: true } },
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
    assertSameOrigin(req)
    const input = clienteComPetsSchema.parse(await req.json())
    const { pets, ...campos } = input
    const data = clienteInputSchema.parse(campos)
    // Cliente e todos os pets são cadastrados de forma atômica.
    const cliente = await db.cliente.create({
      data: {
        ...data,
        pets: { create: pets },
      },
      include: { pets: true },
    })
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
