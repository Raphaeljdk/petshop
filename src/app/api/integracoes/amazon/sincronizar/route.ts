import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { isUnlimitedBathProduct, officialStockFromSources } from '@/lib/product-stock'
import { AmazonSpApiError, amazonSellerListings } from '@/lib/amazon-sp-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const catalog = await amazonSellerListings(500)
    let created = 0
    let updated = 0
    let linked = 0
    let skipped = 0

    for (const item of catalog.items) {
      if (!item.asin) {
        skipped += 1
        continue
      }

      let existing = await db.produto.findFirst({
        where: { amazonAsin: item.asin },
      })
      let matchedBySku = false

      if (!existing && item.sku) {
        const skuMatches = await db.produto.findMany({
          where: { sku: item.sku },
          take: 2,
        })
        const compatible = skuMatches.filter(
          (row) => !row.amazonAsin || row.amazonAsin === item.asin
        )
        if (compatible.length === 1) {
          existing = compatible[0]
          matchedBySku = true
        }
      }

      const sourceStock = item.quantity
      const estoqueIlimitado = isUnlimitedBathProduct({
        nome: item.title,
        categoria: item.productType || 'Amazon',
      })
      const estoqueOperacional = officialStockFromSources({
        zettaProCod: existing?.zettaProCod,
        mlItemId: existing?.mlItemId,
        amazonAsin: item.asin,
        estoqueHub: existing?.estoqueHub,
        estoqueZetta: existing?.estoqueZetta,
        estoqueMercadoLivre: existing?.estoqueMercadoLivre,
        estoqueAmazon: sourceStock,
      })

      const marketplaceData = {
        nome: item.title,
        categoria: item.productType || 'Amazon',
        preco: item.price ?? existing?.preco ?? 0,
        estoque: estoqueOperacional,
        estoqueAmazon: sourceStock,
        estoqueIlimitado,
        sku: item.sku,
        amazonAsin: item.asin,
        imageUrl: item.imageUrl || existing?.imageUrl || null,
      }

      if (existing) {
        const zettaMaster = Boolean(existing.zettaProCod)
        const preserveMaster = zettaMaster || matchedBySku

        await db.produto.update({
          where: { id: existing.id },
          data: zettaMaster
            ? {
                // Amazon é apenas um canal deste produto. Nunca altera o
                // estoque físico/oficial controlado pelo Zetta.
                amazonAsin: item.asin,
                estoqueAmazon: sourceStock,
                ...(!existing.imageUrl && item.imageUrl
                  ? { imageUrl: item.imageUrl }
                  : {}),
              }
            : preserveMaster
              ? {
                  amazonAsin: item.asin,
                  estoqueAmazon: sourceStock,
                  estoqueIlimitado,
                  estoque: estoqueOperacional,
                  ...(!existing.imageUrl && item.imageUrl
                    ? { imageUrl: item.imageUrl }
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
            estoqueMercadoLivre: 0,
            estoqueAmazon: sourceStock,
            estoqueIlimitado,
            mlItemId: null,
            zettaProCod: null,
            ativo: false,
          },
        })
        created += 1
      }
    }

    await db.integracao.upsert({
      where: { id: 'amazon-sp-api' },
      create: {
        id: 'amazon-sp-api',
        plataforma: 'amazon',
        ativo: true,
        sellerId: catalog.sellerId,
        domain: 'amazon.com.br',
        ultimaSync: new Date(),
      },
      update: {
        ativo: true,
        sellerId: catalog.sellerId,
        domain: 'amazon.com.br',
        ultimaSync: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      sellerId: catalog.sellerId,
      marketplaceId: catalog.marketplaceId,
      synchronized: catalog.items.length,
      created,
      updated,
      linked,
      skipped,
      newProductsHidden: created,
      truncated: catalog.truncated,
    })
  } catch (error) {
    const message =
      error instanceof AmazonSpApiError
        ? error.message
        : 'Não foi possível sincronizar o catálogo Amazon.'

    return NextResponse.json(
      { error: message },
      { status: error instanceof AmazonSpApiError ? error.status : 503 }
    )
  }
}
