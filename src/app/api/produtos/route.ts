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

    const produtos = await db.produto.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(produtos)
  } catch (e) {
    console.error('produtos GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar produtos' }, { status: 500 })
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
    const {
      nome,
      descricao,
      categoria,
      preco,
      precoPromo,
      estoque,
      sku,
      mlItemId,
      amazonAsin,
      imageUrl,
      ativo,
    } = body

    if (!nome || !categoria || typeof preco !== 'number') {
      return NextResponse.json(
        { error: 'nome, categoria e preco são obrigatórios' },
        { status: 400 }
      )
    }

    const produto = await db.produto.create({
      data: {
        nome,
        descricao: descricao || null,
        categoria,
        preco,
        precoPromo: typeof precoPromo === 'number' ? precoPromo : null,
        estoque: typeof estoque === 'number' ? estoque : 0,
        sku: sku || null,
        mlItemId: mlItemId || null,
        amazonAsin: amazonAsin || null,
        imageUrl: imageUrl || null,
        ativo: ativo !== undefined ? Boolean(ativo) : true,
      },
    })

    return NextResponse.json(produto, { status: 201 })
  } catch (e) {
    console.error('produtos POST erro:', e)
    return NextResponse.json({ error: 'Erro ao criar produto' }, { status: 500 })
  }
}
