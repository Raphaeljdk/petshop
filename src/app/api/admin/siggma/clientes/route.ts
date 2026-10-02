import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import {
  normalizeCpfCnpj,
  syncSiggmaClient,
  syncSiggmaClientByCode,
  validCpfCnpj,
} from '@/lib/siggma/customer'
import { siggma } from '@/lib/siggma/service'

async function requireAdmin() {
  const user = await getUsuarioLogado()
  if (!user) return { error: 'Não autenticado', status: 401 } as const
  if (user.role !== 'ADMIN') return { error: 'Acesso negado', status: 403 } as const
  return { user } as const
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const id = Number(req.nextUrl.searchParams.get('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Cliente inválido' }, { status: 400 })
  }

  try {
    const client = await siggma.clientes.buscar(id)
    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      cliente: {
        cliCod: client.cliCod,
        cpfCnpj: normalizeCpfCnpj(client.cliDoc || client.pessoa?.cpfcnpj),
        nome: client.pessoa?.nome || '',
        email: client.pessoa?.email || '',
        telefone: client.pessoa?.celular || client.pessoa?.telefone || '',
        endereco: client.pessoa?.endereco || '',
        cep: client.pessoa?.cep || '',
      },
    })
  } catch (error) {
    console.error('siggma cliente GET:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao consultar cliente no Siggma' },
      { status: 502 }
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await req.json()
    const cpfCnpj = normalizeCpfCnpj(body?.cpfCnpj)
    const nome = text(body?.nome)
    const telefone = text(body?.telefone)

    if (!nome || !cpfCnpj) {
      return NextResponse.json(
        { error: 'Nome e CPF/CNPJ são obrigatórios' },
        { status: 400 }
      )
    }
    if (!validCpfCnpj(cpfCnpj)) {
      return NextResponse.json({ error: 'CPF/CNPJ inválido' }, { status: 400 })
    }

    const cliCod = await syncSiggmaClient({
      cpfCnpj,
      nome,
      telefone,
      email: text(body?.email) || null,
      endereco: text(body?.endereco) || null,
      cep: text(body?.cep) || null,
    })

    return NextResponse.json({ success: true, cliCod }, { status: 201 })
  } catch (error) {
    console.error('siggma cliente POST:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar cliente no Siggma' },
      { status: 502 }
    )
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await req.json()
    const cliCod = Number(body?.cliCod)
    if (!Number.isInteger(cliCod) || cliCod <= 0) {
      return NextResponse.json({ error: 'Código do cliente inválido' }, { status: 400 })
    }

    const cpfCnpj =
      body?.cpfCnpj === undefined ? undefined : normalizeCpfCnpj(body.cpfCnpj)
    if (cpfCnpj !== undefined && !validCpfCnpj(cpfCnpj)) {
      return NextResponse.json({ error: 'CPF/CNPJ inválido' }, { status: 400 })
    }

    const synced = await syncSiggmaClientByCode(cliCod, {
      cpfCnpj,
      nome: body?.nome === undefined ? undefined : text(body.nome),
      telefone: body?.telefone === undefined ? undefined : text(body.telefone),
      email: body?.email === undefined ? undefined : text(body.email) || null,
      endereco:
        body?.endereco === undefined ? undefined : text(body.endereco) || null,
      cep: body?.cep === undefined ? undefined : text(body.cep) || null,
    })

    return NextResponse.json({ success: true, cliCod: synced })
  } catch (error) {
    console.error('siggma cliente PUT:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar cliente no Siggma' },
      { status: 502 }
    )
  }
}
