import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'

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

    const produtoExistente = await db.produto.findUnique({ where: { id } })
    if (!produtoExistente) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    const dados: any = {}
    if (nome !== undefined) dados.nome = nome
    if (descricao !== undefined) dados.descricao = descricao
    if (categoria !== undefined) dados.categoria = categoria
    if (preco !== undefined) dados.preco = preco
    if (precoPromo !== undefined) dados.precoPromo = precoPromo
    if (estoque !== undefined) dados.estoque = estoque
    if (sku !== undefined) dados.sku = sku
    if (mlItemId !== undefined) dados.mlItemId = mlItemId
    if (amazonAsin !== undefined) dados.amazonAsin = amazonAsin
    if (imageUrl !== undefined) dados.imageUrl = imageUrl
    if (ativo !== undefined) dados.ativo = Boolean(ativo)

    const produto = await db.produto.update({
      where: { id },
      data: dados,
    })

    return NextResponse.json(produto)
  } catch (e) {
    console.error('produto PUT erro:', e)
    return NextResponse.json({ error: 'Erro ao atualizar produto' }, { status: 500 })
  }
}

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
    const produtoExistente = await db.produto.findUnique({ where: { id } })
    if (!produtoExistente) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    await db.produto.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('produto DELETE erro:', e)
    return NextResponse.json({ error: 'Erro ao deletar produto' }, { status: 500 })
  }
}
