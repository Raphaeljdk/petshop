import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Vercel Functions recebem no máximo 4,5 MB por requisição. O navegador compacta imagens maiores.
const MAX_ORIGINAL_BYTES = 4 * 1024 * 1024
const MAX_WEBP_BYTES = 1500 * 1024
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Upload apenas por administradores. Não grava no disco efêmero da Vercel. */
export async function POST(request: NextRequest) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas administradores podem enviar imagens.' }, { status: 403 })
    }

    const lengthHeader = Number(request.headers.get('content-length'))
    if (Number.isFinite(lengthHeader) && lengthHeader > MAX_ORIGINAL_BYTES + 128 * 1024) {
      return NextResponse.json({ error: 'A imagem enviada deve ter no máximo 4 MB.' }, { status: 413 })
    }

    const form = await request.formData()
    const arquivo = form.get('file')
    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: 'Selecione uma imagem do computador.' }, { status: 400 })
    }
    if (!ACCEPTED_TYPES.has(arquivo.type) || arquivo.size === 0 || arquivo.size > MAX_ORIGINAL_BYTES) {
      return NextResponse.json({ error: 'Envie JPEG, PNG ou WebP de até 4 MB após otimização.' }, { status: 400 })
    }

    const bytes = Buffer.from(await arquivo.arrayBuffer())
    // A decodificação pelo Sharp valida o conteúdo real: não confia só no MIME.
    const imagem = sharp(bytes, { limitInputPixels: 25_000_000, failOn: 'error' })
    const metadata = await imagem.metadata()
    if (!metadata.width || !metadata.height || !['jpeg', 'png', 'webp'].includes(metadata.format || '')) {
      return NextResponse.json({ error: 'Arquivo de imagem inválido.' }, { status: 400 })
    }

    const otimizada = await imagem.rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toBuffer()

    if (otimizada.length > MAX_WEBP_BYTES) {
      return NextResponse.json({ error: 'Imagem muito grande após otimização.' }, { status: 413 })
    }

    const foto = await db.produtoImagem.create({
      data: { conteudo: otimizada, tipo: 'image/webp' },
      select: { id: true },
    })
    return NextResponse.json(
      { imageUrl: `/api/produtos/imagens/${foto.id}` },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[imagens] erro de upload:', error)
    return NextResponse.json({ error: 'Falha ao enviar imagem. Tente outra foto.' }, { status: 500 })
  }
}
