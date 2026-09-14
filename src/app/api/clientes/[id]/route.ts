import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/clientes/[id]
 *
 * Atualiza um cliente existente. Acesso exclusivo de ADMIN.
 * Campos aceitos: nome, telefone, email, endereco, cep.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { nome, telefone, email, endereco, cep } = body

    const clienteExistente = await db.cliente.findUnique({ where: { id } })
    if (!clienteExistente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    // Validação de e-mail único (se estiver sendo alterado)
    if (email && email !== clienteExistente.email) {
      const conflito = await db.cliente.findUnique({
        where: { email: String(email) },
      })
      if (conflito && conflito.id !== id) {
        return NextResponse.json(
          { error: 'E-mail já cadastrado para outro cliente' },
          { status: 409 }
        )
      }
    }

    const cliente = await db.cliente.update({
      where: { id },
      data: {
        ...(nome !== undefined ? { nome: String(nome) } : {}),
        ...(telefone !== undefined ? { telefone: String(telefone) } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        ...(endereco !== undefined ? { endereco: endereco || null } : {}),
        ...(cep !== undefined ? { cep: cep || null } : {}),
      },
      include: { pets: true },
    })

    return NextResponse.json(cliente)
  } catch (e) {
    console.error('clientes PUT erro:', e)
    return NextResponse.json({ error: 'Erro ao atualizar cliente' }, { status: 500 })
  }
}

/**
 * DELETE /api/clientes/[id]
 *
 * Exclui um cliente. Acesso exclusivo de ADMIN.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params
    const clienteExistente = await db.cliente.findUnique({ where: { id } })
    if (!clienteExistente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    await db.cliente.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('clientes DELETE erro:', e)
    return NextResponse.json({ error: 'Erro ao excluir cliente' }, { status: 500 })
  }
}
