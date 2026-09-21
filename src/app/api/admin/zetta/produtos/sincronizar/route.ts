import { authFailure, authJson, AuthError, authReady } from '@/lib/auth-http'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { db } from '@/lib/db'
import {
  getAllZettaProducts,
  zettaProductPrice,
  zettaProductSku,
  zettaProductStock,
} from '@/lib/zetta-products'

async function requireAdmin() {
  authReady()
  const user = await getUsuarioLogado()
  if (!user) throw new AuthError('Entre na sua conta para continuar.', 401)
  if (user.role !== 'ADMIN') {
    throw new AuthError('Acesso permitido apenas à administração.', 403)
  }
}

export async function POST() {
  try {
    await requireAdmin()

    const products = await getAllZettaProducts()
    const valid = products.filter(
      (product) =>
        Number.isFinite(Number(product.id)) &&
        Number(product.id) > 0 &&
        !product.excluido
    )

    const zettaIds = valid.map((product) => Number(product.id))

    const operations = valid.map((product) =>
      db.produto.upsert({
        where: { zettaProCod: Number(product.id) },
        create: {
          nome: product.nome || `Produto Zetta ${product.id}`,
          descricao: null,
          categoria: 'ERP Zetta',
          preco: zettaProductPrice(product),
          precoPromo: null,
          estoque: zettaProductStock(product),
          sku: zettaProductSku(product),
          zettaProCod: Number(product.id),
          imageUrl: null,
          ativo: true,
        },
        update: {
          nome: product.nome || `Produto Zetta ${product.id}`,
          preco: zettaProductPrice(product),
          estoque: zettaProductStock(product),
          sku: zettaProductSku(product),
          ativo: true,
        },
      })
    )

    await db.$transaction(operations)

    const desativados = await db.produto.updateMany({
      where: {
        zettaProCod: { not: null, notIn: zettaIds },
      },
      data: {
        ativo: false,
        estoque: 0,
      },
    })

    return authJson({
      success: true,
      source: 'zetta',
      totalZetta: valid.length,
      sincronizados: valid.length,
      desativados: desativados.count,
    })
  } catch (error) {
    return authFailure(error)
  }
}
