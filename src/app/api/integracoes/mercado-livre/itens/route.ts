import { NextRequest, NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { mercadoLivreAccessToken } from '@/lib/mercado-livre'

export const runtime = 'nodejs'

type SearchResult = { results?: string[]; paging?: { total?: number } }
type BulkResult = { id?: string; status_code?: number; body?: {
  id?: string; title?: string; price?: number; currency_id?: string; available_quantity?: number;
  status?: string; permalink?: string; thumbnail?: string
} }

export async function GET(req: NextRequest) {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const rawPage = Number(req.nextUrl.searchParams.get('page') || '1')
  if (!Number.isInteger(rawPage) || rawPage < 1 || rawPage > 1000) return NextResponse.json({ error: 'Página inválida' }, { status: 400 })
  const limit = 20
  try {
    const { token, sellerId } = await mercadoLivreAccessToken()
    const headers = { Authorization: `Bearer ${token}` }
    const searchUrl = new URL(`https://api.mercadolibre.com/users/${encodeURIComponent(sellerId)}/items/search`)
    searchUrl.searchParams.set('limit', String(limit))
    searchUrl.searchParams.set('offset', String((rawPage - 1) * limit))
    const searchResponse = await fetch(searchUrl, { headers, cache: 'no-store' })
    if (!searchResponse.ok) throw new Error(`Busca de anúncios falhou (${searchResponse.status})`)
    const search = await searchResponse.json() as SearchResult
    const ids = (search.results || []).filter(id => /^ML[A-Z]\d+$/.test(id)).slice(0, limit)
    if (!ids.length) return NextResponse.json({ items: [], page: rawPage, total: search.paging?.total || 0 }, { headers: { 'Cache-Control': 'no-store' } })

    const bulkUrl = new URL('https://api.mercadolibre.com/items/bulk')
    bulkUrl.searchParams.set('ids', ids.join(','))
    bulkUrl.searchParams.set('attributes', 'body.id,body.title,body.price,body.currency_id,body.available_quantity,body.status,body.permalink,body.thumbnail')
    const bulkResponse = await fetch(bulkUrl, { headers, cache: 'no-store' })
    if (!bulkResponse.ok) throw new Error(`Detalhes dos anúncios falharam (${bulkResponse.status})`)
    const bulk = await bulkResponse.json() as BulkResult[]
    const items = bulk.filter(result => result.status_code === 200 && result.body?.id).map(result => ({
      id: result.body!.id!, title: result.body!.title || 'Sem título', price: result.body!.price ?? null,
      currency: result.body!.currency_id || 'BRL', quantity: result.body!.available_quantity ?? 0,
      status: result.body!.status || 'unknown',
      permalink: result.body!.permalink?.startsWith('https://') ? result.body!.permalink : null,
      thumbnail: result.body!.thumbnail?.startsWith('https://') ? result.body!.thumbnail : null,
    }))
    return NextResponse.json({ items, page: rawPage, total: search.paging?.total || 0 }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Mercado Livre itens:', error instanceof Error ? error.message : 'falha')
    return NextResponse.json({ error: 'Não foi possível consultar os anúncios. Verifique a conexão do Mercado Livre.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
