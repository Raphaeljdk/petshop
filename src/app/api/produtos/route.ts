import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { isUnlimitedBathProduct, officialStockFromSources } from '@/lib/product-stock'

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    try {
      const produtos = await db.produto.findMany({
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json(
        produtos.map((produto) => ({
          ...produto,
          estoque: produto.estoqueIlimitado
            ? produto.estoque
            : officialStockFromSources(produto),
        }))
      )
    } catch (prismaError) {
      console.warn(
        '[produtos GET] usando compatibilidade com schema anterior:',
        prismaError instanceof Error ? prismaError.message : prismaError
      )

      const legacy = await db.$queryRawUnsafe<Array<{
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
      }>>(
        'SELECT "id","nome","descricao","categoria","preco","precoPromo","estoque","sku","zettaProCod","mlItemId","amazonAsin","imageUrl","ativo","createdAt","updatedAt" FROM "Produto" ORDER BY "createdAt" DESC'
      )

      return NextResponse.json(
        legacy.map((produto) => {
          const estoqueBase = Math.max(0, Number(produto.estoque || 0))
          const estoqueIlimitado = isUnlimitedBathProduct(produto)

          return {
            ...produto,
            estoqueHub:
              !produto.zettaProCod && !produto.mlItemId && !produto.amazonAsin
                ? estoqueBase
                : 0,
            estoqueZetta: produto.zettaProCod ? estoqueBase : 0,
            estoqueMercadoLivre:
              produto.mlItemId && !produto.zettaProCod ? estoqueBase : 0,
            estoqueAmazon:
              produto.amazonAsin && !produto.zettaProCod && !produto.mlItemId
                ? estoqueBase
                : 0,
            estoqueIlimitado,
            schemaCompatibilidade: true,
          }
        })
      )
    }
  } catch (e) {
    console.error('produtos GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar produtos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

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

    if (!nome || !categoria || typeof preco !== 'number') {
      return NextResponse.json(
        { error: 'nome, categoria e preco são obrigatórios' },
        { status: 400 }
      )
    }

    const produto = await db.produto.create({
      data: {
        nome,
        descricao: descricao || null,
        categoria,
        preco,
        precoPromo: typeof precoPromo === 'number' ? precoPromo : null,
        estoque: typeof estoque === 'number' ? estoque : 0,
        estoqueHub: typeof estoque === 'number' ? estoque : 0,
        estoqueZetta: 0,
        estoqueMercadoLivre: 0,
        estoqueAmazon: 0,
        estoqueIlimitado: isUnlimitedBathProduct({ nome, categoria }),
        sku: sku || null,
        mlItemId: mlItemId || null,
        amazonAsin: amazonAsin || null,
        imageUrl: imageUrl || null,
        ativo: ativo !== undefined ? Boolean(ativo) : true,
      },
    })

    return NextResponse.json(produto, { status: 201 })
  } catch (e) {
    console.error('produtos POST erro:', e)
    return NextResponse.json({ error: 'Erro ao criar produto' }, { status: 500 })
  }
}
