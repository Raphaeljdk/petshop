import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!/^c[a-z0-9]{15,39}$/.test(id)) {
    return new NextResponse(null, { status: 404 })
  }
  try {
    const imagem = await db.produtoImagem.findUnique({
      where: { id },
      select: { tipo: true, conteudo: true },
    })
    if (!imagem) return new NextResponse(null, { status: 404 })
    // Somente WebP é gravado; cada upload usa um novo ID imutável.
    const data = new Uint8Array(imagem.conteudo).buffer as ArrayBuffer
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[imagens] erro de leitura:', error)
    return NextResponse.json({ error: 'Imagem indisponível.' }, { status: 500 })
  }
}
