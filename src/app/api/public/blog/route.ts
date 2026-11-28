import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    // Consent for client diaries is limited to other customers inside the portal.
    const articles = await db.portalArticle.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        title: true,
        category: true,
        summary: true,
        body: true,
        imageUrl: true,
        productId: true,
        createdAt: true,
      },
    })
    return NextResponse.json({ articles }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar os artigos agora.' }, { status: 503 })
  }
}
