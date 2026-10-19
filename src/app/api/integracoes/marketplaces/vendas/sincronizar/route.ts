import { NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { syncMarketplaceSalesToLocal } from '@/lib/marketplace-sync'
import { syncLocalStockToMarketplaces } from '@/lib/inventory-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const result = await syncMarketplaceSalesToLocal()
  // Registre pedidos no ERP próprio e publique o estoque local nos canais.
  const inventory = await syncLocalStockToMarketplaces().catch((error) => ({
    products: 0,
    mercadoLivreUpdated: 0,
    amazonUpdated: 0,
    skippedUnlinked: 0,
    errors: [
      error instanceof Error
        ? error.message
        : 'Falha ao sincronizar o estoque unificado.',
    ],
  }))

  return NextResponse.json({ success: true, ...result, inventory })
}
