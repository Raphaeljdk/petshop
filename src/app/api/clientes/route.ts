import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'

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
    const { nome, telefone, email, endereco, cep } = body

    if (!nome || !telefone) {
      return NextResponse.json(
        { error: 'Nome e telefone são obrigatórios' },
        { status: 400 }
      )
    }

    const cliente = await db.cliente.create({
      data: {
        nome,
        telefone,
        email: email || null,
        endereco: endereco || null,
        cep: cep || null,
      },
      include: { pets: true },
    })

    return NextResponse.json(cliente, { status: 201 })
  } catch (e) {
    console.error('clientes POST erro:', e)
    return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 })
  }
}
