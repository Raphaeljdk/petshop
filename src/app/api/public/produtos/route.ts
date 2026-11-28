import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { legacyProducts, type LegacyProductRow } from '@/lib/product-compat'
import { isServiceProduct, officialStockFromSources } from '@/lib/product-stock'
import { catalogGroupKey, groupCatalogProducts } from '@/lib/product-variants'
import { getProductBrand, recoverCatalogImages } from '@/lib/product-brands'

import { paidSaleWhere } from '@/lib/sales-policy'

export const dynamic = 'force-dynamic'

/**
 * A vitrine pública deve ser somente leitura. Nunca executar sincronização
 * Zetta/Siggma ao carregar ou atualizar a página.
 * Não manter cache de estoque depois de uma conferência manual do lojista.
 */
type PublicRow = LegacyProductRow & { estoqueIlimitado: boolean }
async function listarProdutosPublicos(): Promise<PublicRow[]> {
  try {
    const produtos = await db.produto.findMany({
      where: { ativo: true },
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    })
    return recoverCatalogImages(
      produtos
        .map((produto) => ({
          ...produto,
          estoque: produto.estoqueIlimitado ? produto.estoque : officialStockFromSources(produto),
        }))
        .filter((produto) => !isServiceProduct(produto)),
    )
  } catch (error) {
    console.warn('[public/produtos] leitura local incompatível:', error)
    return recoverCatalogImages(
      (await legacyProducts({ onlyActive: true })).filter((produto) => !isServiceProduct(produto)),
    )
  }
}

export async function GET() {
  try {
    const [rows, sales] = await Promise.all([
      listarProdutosPublicos(),
      db.itemVenda
        .groupBy({
          by: ['produtoId'],
          where: {
            venda: { ...paidSaleWhere, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
          },
          _sum: { quantidade: true },
        })
        .catch(() => []),
    ])
    const sold = new Map<string, number>()
    for (const sale of sales) sold.set(sale.produtoId, sale._sum.quantidade || 0)
    const families = new Map<string, { quantity: number; createdAt: Date }>()
    for (const row of rows) {
      const key = catalogGroupKey(row)
      const family = families.get(key) || { quantity: 0, createdAt: row.createdAt }
      family.quantity += sold.get(row.id) || 0
      if (row.createdAt < family.createdAt) family.createdAt = row.createdAt
      families.set(key, family)
    }
    const groups = groupCatalogProducts(rows)
    const keyById = new Map(rows.map((p) => [p.id, catalogGroupKey(p)] as const))
    const ranked = groups
      .filter(
        (p) => (p.estoqueIlimitado || p.estoque > 0) && families.get(keyById.get(p.id)!)!.quantity > 0,
      )
      .sort(
        (a, b) =>
          families.get(keyById.get(b.id)!)!.quantity - families.get(keyById.get(a.id)!)!.quantity ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 8)
    const ranks = new Map(ranked.map((p, i) => [p.id, i + 1]))
    const publicFields = (p: (typeof groups)[number]) => ({
      id: p.id,
      nome: p.nome,
      descricao: p.descricao,
      categoria: p.categoria,
      preco: p.preco,
      precoPromo: p.precoPromo,
      estoque: p.estoque,
      estoqueIlimitado: p.estoqueIlimitado,
      imageUrl: p.imageUrl,
      marca: getProductBrand(p),
      origem: p.zettaProCod ? 'zetta' : p.mlItemId ? 'mercado_livre' : p.amazonAsin ? 'amazon' : 'hub',
      variacaoLabel: p.variacaoLabel ?? null,
      corLabel: p.corLabel ?? null,
      modeloLabel: p.modeloLabel ?? null,
    })
    return NextResponse.json(
      groups
        .sort(
          (a, b) =>
            Number(Boolean(b.estoqueIlimitado || b.estoque > 0)) -
              Number(Boolean(a.estoqueIlimitado || a.estoque > 0)) ||
            a.nome.localeCompare(b.nome, 'pt-BR'),
        )
        .map((p) => ({
          ...publicFields(p),
          createdAt: families.get(keyById.get(p.id)!)!.createdAt,
          bestSellerRank: ranks.get(p.id),
          variantes: p.variantes?.map(publicFields),
          origens: [
            p.zettaProCod ? 'zetta' : null,
            p.mlItemId ? 'mercado_livre' : null,
            p.amazonAsin ? 'amazon' : null,
            !p.zettaProCod && !p.mlItemId && !p.amazonAsin ? 'hub' : null,
          ].filter(Boolean),
        })),
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (error) {
    console.error('[public/produtos] erro:', error)
    return NextResponse.json({ error: 'Não foi possível carregar a vitrine.' }, { status: 500 })
  }
}
