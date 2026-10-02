import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { isUnlimitedBathProduct, officialStockFromSources } from '@/lib/product-stock'
import { mercadoLivreAccessToken } from '@/lib/mercado-livre'
import {
  mercadoLivreCategoryNames,
  mercadoLivreItemsByIds,
  mercadoLivreSellerItemIds,
} from '@/lib/mercado-livre-items'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const { token, sellerId } = await mercadoLivreAccessToken()
    const search = await mercadoLivreSellerItemIds(sellerId, token)
    const items = await mercadoLivreItemsByIds(search.ids, token)
    const categories = await mercadoLivreCategoryNames(
      items.map((item) => item.categoryId),
      token
    )

    let created = 0
    let updated = 0
    let linked = 0

    for (const item of items) {
      let existing = await db.produto.findFirst({
        where: { mlItemId: item.id },
      })
      let matchedBySku = false

      if (!existing && item.sku && item.sku !== item.id) {
        const skuMatches = await db.produto.findMany({
          where: { sku: item.sku },
          take: 2,
        })
        const compatible = skuMatches.filter(
          (row) => !row.mlItemId || row.mlItemId === item.id
        )
        if (compatible.length === 1) {
          existing = compatible[0]
          matchedBySku = true
        }
      }

      const sourceStock = item.status === 'active' ? item.quantity : 0
      const estoqueIlimitado = isUnlimitedBathProduct({
        nome: item.title,
        categoria: item.categoryId ? categories.get(item.categoryId) || 'Mercado Livre' : 'Mercado Livre',
      })
      const estoqueOperacional = officialStockFromSources({
        zettaProCod: existing?.zettaProCod,
        mlItemId: item.id,
        amazonAsin: existing?.amazonAsin,
        estoqueHub: existing?.estoqueHub,
        estoqueZetta: existing?.estoqueZetta,
        estoqueMercadoLivre: sourceStock,
        estoqueAmazon: existing?.estoqueAmazon,
      })

      const marketplaceData = {
        nome: item.title,
        categoria: item.categoryId
          ? categories.get(item.categoryId) || 'Mercado Livre'
          : 'Mercado Livre',
        preco: item.price,
        estoque: estoqueOperacional,
        estoqueMercadoLivre: sourceStock,
        estoqueIlimitado,
        sku: item.sku || item.id,
        mlItemId: item.id,
        imageUrl: item.thumbnail,
      }

      if (existing) {
        const zettaMaster = Boolean(existing.zettaProCod)
        const preserveMaster = zettaMaster || matchedBySku

        await db.produto.update({
          where: { id: existing.id },
          data: zettaMaster
            ? {
                // Mercado Livre é apenas um canal deste produto. Nunca altera
                // o estoque físico/oficial controlado pelo Zetta.
                mlItemId: item.id,
                estoqueMercadoLivre: sourceStock,
                ...(!existing.imageUrl && item.thumbnail
                  ? { imageUrl: item.thumbnail }
                  : {}),
              }
            : preserveMaster
              ? {
                  mlItemId: item.id,
                  estoqueMercadoLivre: sourceStock,
                  estoqueIlimitado,
                  estoque: estoqueOperacional,
                  ...(!existing.imageUrl && item.thumbnail
                    ? { imageUrl: item.thumbnail }
                    : {}),
                }
              : marketplaceData,
        })
        if (matchedBySku) linked += 1
        updated += 1
      } else {
        await db.produto.create({
          data: {
            ...marketplaceData,
            descricao: null,
            precoPromo: null,
            estoqueHub: 0,
            estoqueZetta: 0,
            estoqueMercadoLivre: sourceStock,
            estoqueAmazon: 0,
            estoqueIlimitado,
            amazonAsin: null,
            ativo: false,
          },
        })
        created += 1
      }
    }

    let staleReset = 0
    if (!search.truncated) {
      const seenIds = new Set(search.ids)
      const linkedProducts = await db.produto.findMany({
        where: { mlItemId: { not: null } },
        select: {
          id: true,
          mlItemId: true,
          zettaProCod: true,
          amazonAsin: true,
          estoqueHub: true,
          estoqueZetta: true,
          estoqueMercadoLivre: true,
          estoqueAmazon: true,
          estoqueIlimitado: true,
        },
      })

      for (const product of linkedProducts) {
        if (!product.mlItemId || seenIds.has(product.mlItemId)) continue

        const estoqueOperacional = officialStockFromSources({
          ...product,
          estoqueMercadoLivre: 0,
        })

        await db.produto.update({
          where: { id: product.id },
          data: {
            estoqueMercadoLivre: 0,
            ...(product.estoqueIlimitado
              ? {}
              : { estoque: estoqueOperacional }),
          },
        })
        staleReset += 1
      }
    }

    return NextResponse.json({
      success: true,
      sellerId,
      totalMarketplace: search.total,
      synchronized: items.length,
      created,
      updated,
      linked,
      newProductsHidden: created,
      staleReset,
      truncated: search.truncated,
    })
  } catch (error) {
    console.error(
      'Mercado Livre sincronizar:',
      error instanceof Error ? error.message : 'falha'
    )

    return NextResponse.json(
      {
        error:
          'Não foi possível sincronizar o catálogo do Mercado Livre. Verifique a conexão e tente novamente.',
      },
      { status: 503 }
    )
  }
}
