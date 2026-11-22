import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { isUnlimitedBathProduct } from '@/lib/product-stock'
import { hubChangeNeedsMarketplaceSync, stockWritesEnabled } from '@/lib/marketplace-stock-safety'
import { syncLocalStockToMarketplaces } from '@/lib/inventory-sync'

export const runtime = 'nodejs'
export const maxDuration = 120

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

    // A Matilha Prado passa a controlar inclusive produtos importados.
    if (nome !== undefined) dados.nome = String(nome).trim()
    if (preco !== undefined) {
      if (!Number.isFinite(preco) || preco < 0) {
        return NextResponse.json({ error: 'Preço inválido.' }, { status: 400 })
      }
      dados.preco = preco
    }
    if (precoPromo !== undefined) dados.precoPromo = precoPromo
    if (estoque !== undefined) {
      if (!Number.isInteger(estoque) || estoque < 0) {
        return NextResponse.json({ error: 'Estoque deve ser um inteiro não negativo.' }, { status: 400 })
      }
      dados.estoque = estoque
      dados.estoqueHub = estoque
    }
    if (sku !== undefined) dados.sku = sku

    if (descricao !== undefined) dados.descricao = descricao
    if (categoria !== undefined) dados.categoria = categoria

    const nomeFinal = nome !== undefined ? String(nome) : produtoExistente.nome
    const categoriaFinal =
      categoria !== undefined ? String(categoria) : produtoExistente.categoria
    dados.estoqueIlimitado = isUnlimitedBathProduct({
      nome: nomeFinal,
      categoria: categoriaFinal,
    })
    if (mlItemId !== undefined) dados.mlItemId = mlItemId
    if (amazonAsin !== undefined) dados.amazonAsin = amazonAsin
    if (imageUrl !== undefined) dados.imageUrl = imageUrl
    if (ativo !== undefined) dados.ativo = Boolean(ativo)

    const produto = await db.produto.update({
      where: { id },
      data: dados,
    })

    // O Hub sempre salva primeiro. O retorno distingue "salvo no Hub"
    // de "confirmado nos canais" para não prometer uma sincronização que falhou.
    const needsSync=hubChangeNeedsMarketplaceSync(produtoExistente,produto)
    if(!needsSync) return NextResponse.json({ ...produto,
      marketplaceSync: { status: 'unchanged' } })
    if(!stockWritesEnabled()) return NextResponse.json({ ...produto,
      marketplaceSync: { status: 'suspended',
        reason:'Estoque salvo no Hub. Envio ML/Amazon suspenso até conciliação de SKUs e liberação segura.' } })
    try {
      const result=await syncLocalStockToMarketplaces({
        productIds:[produto.id],
        explicitlyPublishIds:!produtoExistente.ativo&&produto.ativo?[produto.id]:[],
      })
      return NextResponse.json({ ...produto, marketplaceSync: {
        status:result.errors.length||result.blockedListings?'attention':'submitted',
        mercadoLivreUpdated:result.mercadoLivreUpdated,amazonUpdated:result.amazonUpdated,
        blockedListings:result.blockedListings,errors:result.errors,
      } })
    } catch(syncError) {
      console.error('[hub] saldo salvo, envio aos marketplaces falhou:',syncError)
      return NextResponse.json({ ...produto, marketplaceSync: {
        status:'attention', errors:['Estoque salvo no Hub, mas a atualização dos canais falhou. Verificar pendências.'],
      } })
    }
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

    if (
      produtoExistente.zettaProCod ||
      produtoExistente.mlItemId ||
      produtoExistente.amazonAsin
    ) {
      await db.produto.update({
        where: { id },
        data: { ativo: false },
      })
      return NextResponse.json({ success: true, disabled: true })
    }

    await db.produto.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('produto DELETE erro:', e)
    return NextResponse.json({ error: 'Erro ao deletar produto' }, { status: 500 })
  }
}
