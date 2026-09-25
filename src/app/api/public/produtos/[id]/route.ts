import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getZettaProduct, zettaProductBasePrice, zettaProductPromoPrice, zettaProductStock } from '@/lib/zetta-products'

export const dynamic = 'force-dynamic'

function cleanText(value?: string | null) {
  if (!value) return null

  const withoutHtml = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return withoutHtml || null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const local = await db.produto.findUnique({
      where: { id },
    })

    if (!local || !local.ativo) {
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
    }

    if (!local.zettaProCod) {
      return NextResponse.json({
        id: local.id,
        nome: local.nome,
        descricao: cleanText(local.descricao),
        categoria: local.categoria,
        preco: local.preco,
        precoPromo: local.precoPromo,
        estoque: local.estoque,
        imageUrl: local.imageUrl,
        imagens: local.imageUrl ? [local.imageUrl] : [],
        marca: null,
        modelo: null,
        peso: null,
        altura: null,
        largura: null,
        comprimento: null,
        sku: local.sku,
      })
    }

    try {
      const official = await getZettaProduct(local.zettaProCod)
      const descriptionParts = [
        cleanText(official.complemento),
        cleanText(official.observacao),
      ].filter(Boolean)

      return NextResponse.json({
        id: local.id,
        nome: official.nome || local.nome,
        descricao:
          descriptionParts.length > 0
            ? descriptionParts.join('\n\n')
            : cleanText(local.descricao),
        categoria: local.categoria,
        preco: zettaProductBasePrice(official),
        precoPromo: zettaProductPromoPrice(official),
        estoque: zettaProductStock(official),
        imageUrl: official.galeria?.[0] || local.imageUrl,
        imagens:
          official.galeria && official.galeria.length > 0
            ? official.galeria
            : local.imageUrl
              ? [local.imageUrl]
              : [],
        marca: official.marca || null,
        modelo: official.modelo || null,
        peso: official.peso ?? null,
        altura: official.altura ?? null,
        largura: official.largura ?? null,
        comprimento: official.comprimento ?? null,
        sku: local.sku,
      })
    } catch (siggmaError) {
      console.error('[public/produtos/:id] Siggma indisponível, usando cache local:', siggmaError)

      return NextResponse.json({
        id: local.id,
        nome: local.nome,
        descricao: cleanText(local.descricao),
        categoria: local.categoria,
        preco: local.preco,
        precoPromo: local.precoPromo,
        estoque: local.estoque,
        imageUrl: local.imageUrl,
        imagens: local.imageUrl ? [local.imageUrl] : [],
        marca: null,
        modelo: null,
        peso: null,
        altura: null,
        largura: null,
        comprimento: null,
        sku: local.sku,
      })
    }
  } catch (error) {
    console.error('[public/produtos/:id] erro:', error)
    return NextResponse.json(
      { error: 'Não foi possível carregar os detalhes do produto.' },
      { status: 500 }
    )
  }
}
