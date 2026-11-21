import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { legacyProducts } from '@/lib/product-compat'
import { isServiceProduct, officialStockFromSources } from '@/lib/product-stock'
import { groupCatalogProducts } from '@/lib/product-variants'
import { getProductBrand, recoverCatalogImages } from '@/lib/product-brands'

export const dynamic = 'force-dynamic'

/**
 * A vitrine pública deve ser somente leitura. Nunca executar sincronização
 * Zetta/Siggma ao carregar ou atualizar a página.
 * Não manter cache de estoque depois de uma conferência manual do lojista.
 */
async function listarProdutosPublicos() {
  try {
    const produtos = await db.produto.findMany({
      where: { ativo: true },
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    })
    return groupCatalogProducts(recoverCatalogImages(produtos.map((produto) => ({
      ...produto,
      estoque: produto.estoqueIlimitado
        ? produto.estoque
        : officialStockFromSources(produto),
    })).filter((produto) => !isServiceProduct(produto))))
      .sort((a, b) => {
        const aSemEstoque = !a.estoqueIlimitado && a.estoque <= 0
        const bSemEstoque = !b.estoqueIlimitado && b.estoque <= 0
        if (aSemEstoque !== bSemEstoque) return aSemEstoque ? 1 : -1
        return a.nome.localeCompare(b.nome, 'pt-BR')
      })
  } catch (error) {
    console.warn('[public/produtos] leitura local incompatível:', error)
    return groupCatalogProducts(recoverCatalogImages(
      (await legacyProducts({ onlyActive: true })).filter((produto) => !isServiceProduct(produto))
    )).sort((a, b) => {
      if ((a.estoque <= 0) !== (b.estoque <= 0)) return a.estoque <= 0 ? 1 : -1
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }
}

export async function GET() {
  try {
    const products = await listarProdutosPublicos()
    return NextResponse.json(products.map((product) => ({
      id: product.id,
      nome: product.nome,
      descricao: product.descricao,
      categoria: product.categoria,
      marca: getProductBrand(product),
      preco: product.preco,
      precoPromo: product.precoPromo,
      estoque: product.estoque,
      estoqueIlimitado: product.estoqueIlimitado,
      imageUrl: product.imageUrl,
      origem: product.zettaProCod ? 'zetta'
        : product.mlItemId ? 'mercado_livre'
          : product.amazonAsin ? 'amazon' : 'hub',
      variacaoLabel: product.variacaoLabel ?? null,
      corLabel: product.corLabel ?? null,
      modeloLabel: product.modeloLabel ?? null,
      variantes: product.variantes,
      origens: [
        product.zettaProCod ? 'zetta' : null,
        product.mlItemId ? 'mercado_livre' : null,
        product.amazonAsin ? 'amazon' : null,
        !product.zettaProCod && !product.mlItemId && !product.amazonAsin ? 'hub' : null,
      ].filter(Boolean),
    })), {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    console.error('[public/produtos] erro:', error)
    return NextResponse.json({ error: 'Não foi possível carregar a vitrine.' }, { status: 500 })
  }
}
