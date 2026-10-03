import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import {
  normalizeCpfCnpj,
  syncSiggmaClient,
  validCpfCnpj,
} from '@/lib/siggma/customer'

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const clientes = await db.cliente.findMany({
      orderBy: { createdAt: 'desc' },
      include: { pets: true },
    })

    return NextResponse.json(clientes)
  } catch (e) {
    console.error('clientes GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar clientes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await req.json()
    const { nome, telefone, cpfCnpj, email, endereco, cep } = body

    if (!nome || !telefone) {
      return NextResponse.json(
        { error: 'Nome e telefone são obrigatórios' },
        { status: 400 }
      )
    }

    const documento = cpfCnpj ? normalizeCpfCnpj(String(cpfCnpj)) : null
    if (documento && !validCpfCnpj(documento)) {
      return NextResponse.json({ error: 'CPF/CNPJ inválido' }, { status: 400 })
    }

    if (documento) {
      const conflitoDocumento = await db.cliente.findUnique({
        where: { cpfCnpj: documento },
      })
      if (conflitoDocumento) {
        return NextResponse.json(
          { error: 'CPF/CNPJ já cadastrado para outro cliente' },
          { status: 409 }
        )
      }
    }

    if (email) {
      const conflitoEmail = await db.cliente.findUnique({
        where: { email: String(email) },
      })
      if (conflitoEmail) {
        return NextResponse.json(
          { error: 'E-mail já cadastrado para outro cliente' },
          { status: 409 }
        )
      }
    }

    const siggmaCliCod = documento
      ? await syncSiggmaClient({
          cpfCnpj: documento,
          nome: String(nome),
          telefone: String(telefone),
          email: email ? String(email) : null,
          endereco: endereco ? String(endereco) : null,
          cep: cep ? String(cep) : null,
        })
      : null

    const cliente = await db.cliente.create({
      data: {
        nome: String(nome),
        telefone: String(telefone),
        cpfCnpj: documento,
        email: email ? String(email) : null,
        endereco: endereco ? String(endereco) : null,
        cep: cep ? String(cep) : null,
      },
      include: { pets: true },
    })

    return NextResponse.json(
      {
        ...cliente,
        siggmaCliCod,
        siggmaSync: siggmaCliCod ? 'synced' : 'skipped-no-document',
      },
      { status: 201 }
    )
  } catch (e) {
    console.error('clientes POST erro:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao criar cliente' },
      { status: 500 }
    )
  }
}
