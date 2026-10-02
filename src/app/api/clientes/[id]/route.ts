import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import {
  normalizeCpfCnpj,
  syncSiggmaClient,
  validCpfCnpj,
} from '@/lib/siggma/customer'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/clientes/[id]
 *
 * Atualiza um cliente existente. Acesso exclusivo de ADMIN.
 * Campos aceitos: nome, telefone, cpfCnpj, email, endereco, cep.
 * Quando há CPF/CNPJ, a atualização também é enviada ao cadastro oficial Siggma.
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
    const { nome, telefone, cpfCnpj, email, endereco, cep } = body

    const clienteExistente = await db.cliente.findUnique({ where: { id } })
    if (!clienteExistente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

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

    const documento =
      cpfCnpj !== undefined
        ? normalizeCpfCnpj(String(cpfCnpj || '')) || null
        : clienteExistente.cpfCnpj

    if (documento && !validCpfCnpj(documento)) {
      return NextResponse.json({ error: 'CPF/CNPJ inválido' }, { status: 400 })
    }

    if (documento && documento !== clienteExistente.cpfCnpj) {
      const conflitoDocumento = await db.cliente.findUnique({
        where: { cpfCnpj: documento },
      })
      if (conflitoDocumento && conflitoDocumento.id !== id) {
        return NextResponse.json(
          { error: 'CPF/CNPJ já cadastrado para outro cliente' },
          { status: 409 }
        )
      }
    }

    const dadosFinais = {
      nome: nome !== undefined ? String(nome) : clienteExistente.nome,
      telefone:
        telefone !== undefined ? String(telefone) : clienteExistente.telefone,
      email:
        email !== undefined
          ? email
            ? String(email)
            : null
          : clienteExistente.email,
      endereco:
        endereco !== undefined
          ? endereco
            ? String(endereco)
            : null
          : clienteExistente.endereco,
      cep:
        cep !== undefined
          ? cep
            ? String(cep)
            : null
          : clienteExistente.cep,
    }

    const siggmaCliCod = documento
      ? await syncSiggmaClient({
          cpfCnpj: documento,
          ...dadosFinais,
        })
      : null

    const cliente = await db.cliente.update({
      where: { id },
      data: {
        ...dadosFinais,
        cpfCnpj: documento,
      },
      include: { pets: true },
    })

    if (siggmaCliCod) {
      await db.user.updateMany({
        where: { clienteId: id },
        data: { siggmaCliCod },
      })
    }

    return NextResponse.json({
      ...cliente,
      siggmaCliCod,
      siggmaSync: siggmaCliCod ? 'synced' : 'skipped-no-document',
    })
  } catch (e) {
    console.error('clientes PUT erro:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao atualizar cliente' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/clientes/[id]
 *
 * Exclui um cliente local. A API oficial recebida da Zetta não documenta
 * exclusão de cliente, portanto esta operação não apaga o cadastro no Siggma.
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
