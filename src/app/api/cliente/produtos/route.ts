import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { legacyProducts } from '@/lib/product-compat'
import { isServiceProduct, officialStockFromSources } from '@/lib/product-stock'
import { groupCatalogProducts } from '@/lib/product-variants'
import { getProductBrand, recoverCatalogImages } from '@/lib/product-brands'

export const dynamic = 'force-dynamic'

/**
 * Consultar a loja é SEMPRE uma operação somente de leitura.
 * Nunca reimportar estoque do Zetta/Siggma em GET; isso sobrescrevia ajustes
 * manuais toda vez que um cliente recarregava a página.
 */
export async function GET() {
  try {
    const cached = await db.produto.findMany({
      where: { ativo: true },
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    })
    const produtos = groupCatalogProducts(recoverCatalogImages(cached.map((produto) => ({
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
    return NextResponse.json(produtos.map((produto) => ({
      ...produto, marca: getProductBrand(produto),
    })), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    // Compatibilidade apenas para uma implantação cujo schema não tenha
    // colunas recentes. O fallback também NÃO escreve dados.
    console.error('[cliente/produtos] consulta local falhou:', error)
    try {
      const antigos = await legacyProducts({ onlyActive: true })
      return NextResponse.json(
        groupCatalogProducts(recoverCatalogImages(antigos.filter((p) => !isServiceProduct(p))))
          .sort((a, b) => {
            if (a.estoque <= 0 !== (b.estoque <= 0)) return a.estoque <= 0 ? 1 : -1
            return a.nome.localeCompare(b.nome, 'pt-BR')
          }),
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    } catch (fallbackError) {
      console.error('[cliente/produtos] fallback local falhou:', fallbackError)
      return NextResponse.json({ error: 'Não foi possível carregar os produtos.' }, { status: 500 })
    }
  }
}
