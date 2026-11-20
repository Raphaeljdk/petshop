import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { artigoDeDiario } from '@/lib/portal-pet-blog'

export const dynamic = 'force-dynamic'

/** Somente artigos publicados e diários aprovados COM consentimento expresso são públicos. */
export async function GET() {
  try {
    const [editoriais, diarios] = await Promise.all([
      db.portalArticle.findMany({
        where: { published: true }, orderBy: { createdAt: 'desc' }, take: 12,
        select: { id: true, title: true, category: true, summary: true,
          body: true, imageUrl: true, createdAt: true },
      }),
      db.portalPetMemory.findMany({
        where: { kind: 'diario', blogStatus: 'publicado', blogConsentAt: { not: null }, createdByAdmin: false },
        orderBy: { createdAt: 'desc' }, take: 12,
        select: { id: true, kind: true, title: true, notes: true, imageData: true,
          createdAt: true, eventAt: true, createdByAdmin: true, blogConsentAt: true, blogStatus: true },
      }),
    ])
    const artigos = [
      ...editoriais.map((a) => ({ ...a, isPetStory: false })),
      ...diarios.map(artigoDeDiario).filter((a) => a !== null),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 9)
    return NextResponse.json({ artigos }, {
      headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' },
    })
  } catch (error) {
    console.error('public/blog:', error)
    return NextResponse.json({ error: 'Não foi possível consultar as publicações.' }, { status: 500 })
  }
}
