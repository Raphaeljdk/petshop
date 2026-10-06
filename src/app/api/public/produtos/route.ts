import { unstable_cache } from 'next/cache'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncZettaProductsToLocal } from '@/lib/zetta-products'
import { legacyProducts } from '@/lib/product-compat'
import { isServiceProduct, officialStockFromSources } from '@/lib/product-stock'

function uniqueProducts<T extends { id: string }>(products: T[]) {
  return [...new Map(products.map((product) => [product.id, product])).values()]
}

const getPublicProducts = unstable_cache(
  async () => {
    try {
      const synced = await syncZettaProductsToLocal()
      const complementares = await db.produto.findMany({
        where: { ativo: true },
        orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
      })

      return uniqueProducts([...synced.products, ...complementares])
        .map((produto) => ({
          ...produto,
          estoque: produto.estoqueIlimitado
            ? produto.estoque
            : officialStockFromSources(produto),
        }))
        .filter((produto) => !isServiceProduct(produto))
        .sort((a, b) => {
          const aSemEstoque = !a.estoqueIlimitado && a.estoque <= 0
          const bSemEstoque = !b.estoqueIlimitado && b.estoque <= 0
          if (aSemEstoque !== bSemEstoque) return aSemEstoque ? 1 : -1
          return a.nome.localeCompare(b.nome, 'pt-BR')
        })
    } catch (error) {
      console.error(
        '[public/produtos] Siggma indisponível, usando cache local:',
        error
      )

      try {
        const cached = await db.produto.findMany({
          where: { ativo: true },
          orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
        })
        return cached
          .map((produto) => ({
            ...produto,
            estoque: produto.estoqueIlimitado
              ? produto.estoque
              : officialStockFromSources(produto),
          }))
          .filter((produto) => !isServiceProduct(produto))
        .sort((a, b) => {
          const aSemEstoque = !a.estoqueIlimitado && a.estoque <= 0
          const bSemEstoque = !b.estoqueIlimitado && b.estoque <= 0
          if (aSemEstoque !== bSemEstoque) return aSemEstoque ? 1 : -1
          return a.nome.localeCompare(b.nome, 'pt-BR')
        })
      } catch (schemaError) {
        console.warn(
          '[public/produtos] schema novo ainda não aplicado; usando leitura compatível:',
          schemaError instanceof Error ? schemaError.message : schemaError
        )
        return (await legacyProducts({ onlyActive: true }))
          .filter((produto) => !isServiceProduct(produto))
          .sort((a, b) => {
            const aSemEstoque = a.estoque <= 0
            const bSemEstoque = b.estoque <= 0
            if (aSemEstoque !== bSemEstoque) return aSemEstoque ? 1 : -1
            return a.nome.localeCompare(b.nome, 'pt-BR')
          })
      }
    }
  },
  ['public-products-v5-items-only'],
  { revalidate: 300 }
)

export async function GET() {
  try {
    const products = await getPublicProducts()

    return NextResponse.json(
      products.map((product) => ({
        id: product.id,
        nome: product.nome,
        descricao: product.descricao,
        categoria: product.categoria,
        preco: product.preco,
        precoPromo: product.precoPromo,
        estoque: product.estoque,
        estoqueIlimitado: product.estoqueIlimitado,
        imageUrl: product.imageUrl,
        origem: product.zettaProCod
          ? 'zetta'
          : product.mlItemId
            ? 'mercado_livre'
            : product.amazonAsin
              ? 'amazon'
              : 'hub',
        origens: [
          product.zettaProCod ? 'zetta' : null,
          product.mlItemId ? 'mercado_livre' : null,
          product.amazonAsin ? 'amazon' : null,
          !product.zettaProCod && !product.mlItemId && !product.amazonAsin
            ? 'hub'
            : null,
        ].filter(Boolean),
      })),
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('[public/produtos] erro:', error)
    return NextResponse.json(
      { error: 'Não foi possível carregar a vitrine.' },
      { status: 500 }
    )
  }
}
