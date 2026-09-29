import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
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
    let skipped = 0

    for (const item of catalog.items) {
      if (!item.asin) {
        skipped += 1
        continue
      }

      const existing = await db.produto.findFirst({
        where: {
          amazonAsin: item.asin,
          sku: item.sku,
        },
      })

      const data = {
        nome: item.title,
        categoria: item.productType || 'Amazon',
        preco: item.price ?? existing?.preco ?? 0,
        estoque: item.quantity,
        sku: item.sku,
        amazonAsin: item.asin,
        imageUrl: item.imageUrl || existing?.imageUrl || null,
      }

      if (existing) {
        await db.produto.update({
          where: { id: existing.id },
          data,
        })
        updated += 1
      } else {
        await db.produto.create({
          data: {
            ...data,
            descricao: null,
            precoPromo: null,
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
