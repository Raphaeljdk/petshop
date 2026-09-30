import { db } from '@/lib/db'
import { isUnlimitedBathProduct } from '@/lib/product-stock'

export type LegacyProductRow = {
  id: string
  nome: string
  descricao: string | null
  categoria: string
  preco: number
  precoPromo: number | null
  estoque: number
  sku: string | null
  zettaProCod: number | null
  mlItemId: string | null
  amazonAsin: string | null
  imageUrl: string | null
  ativo: boolean
  createdAt: Date
  updatedAt: Date
}

export function withCompatStock(product: LegacyProductRow) {
  const estoqueBase = Math.max(0, Number(product.estoque || 0))
  const estoqueIlimitado = isUnlimitedBathProduct(product)

  return {
    ...product,
    estoqueHub:
      !product.zettaProCod && !product.mlItemId && !product.amazonAsin
        ? estoqueBase
        : 0,
    estoqueZetta: product.zettaProCod ? estoqueBase : 0,
    estoqueMercadoLivre:
      product.mlItemId && !product.zettaProCod ? estoqueBase : 0,
    estoqueAmazon:
      product.amazonAsin && !product.zettaProCod && !product.mlItemId
        ? estoqueBase
        : 0,
    estoqueIlimitado,
    schemaCompatibilidade: true,
  }
}

export async function legacyProducts(options?: {
  onlyActive?: boolean
  onlyAvailable?: boolean
}) {
  const where: string[] = []
  if (options?.onlyActive) where.push('"ativo" = true')
  if (options?.onlyAvailable) {
    where.push(
      '("estoque" > 0 OR lower(coalesce("nome", \'\')) IN (\'banho\', \'banho e tosa\') OR lower(coalesce("nome", \'\')) LIKE \'banho e tosa%\')'
    )
  }

  const rows = await db.$queryRawUnsafe<LegacyProductRow[]>(
    `SELECT "id","nome","descricao","categoria","preco","precoPromo","estoque","sku","zettaProCod","mlItemId","amazonAsin","imageUrl","ativo","createdAt","updatedAt"
     FROM "Produto"
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY "categoria" ASC, "nome" ASC`
  )

  return rows.map(withCompatStock)
}

export async function legacyProductById(id: string) {
  const rows = await db.$queryRawUnsafe<LegacyProductRow[]>(
    'SELECT "id","nome","descricao","categoria","preco","precoPromo","estoque","sku","zettaProCod","mlItemId","amazonAsin","imageUrl","ativo","createdAt","updatedAt" FROM "Produto" WHERE "id" = $1 LIMIT 1',
    id
  )

  return rows[0] ? withCompatStock(rows[0]) : null
}
