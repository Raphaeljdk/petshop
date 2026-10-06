import { NextRequest, NextResponse } from 'next/server'
import { cancelExpiredPendingSales } from '@/lib/pending-sales'
import { syncMarketplaceSalesToZetta } from '@/lib/marketplace-sync'
import { syncZettaStockToMarketplaces } from '@/lib/inventory-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const configured = process.env.CRON_SECRET?.trim()
  const authorization = req.headers.get('authorization')

  if (!configured || authorization !== `Bearer ${configured}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const pending = await cancelExpiredPendingSales()
  const inventoryBefore = await syncZettaStockToMarketplaces().catch((error) => ({
    products: 0,
    mercadoLivreUpdated: 0,
    amazonUpdated: 0,
    skippedUnlinked: 0,
    errors: [
      error instanceof Error
        ? error.message
        : 'Falha ao reconciliar o estoque antes das vendas.',
    ],
  }))
  const marketplaces = await syncMarketplaceSalesToZetta()
  const inventory = await syncZettaStockToMarketplaces({
    refreshZetta: false,
  }).catch((error) => ({
    products: 0,
    mercadoLivreUpdated: 0,
    amazonUpdated: 0,
    skippedUnlinked: 0,
    errors: [
      error instanceof Error
        ? error.message
        : 'Falha ao propagar a baixa das vendas.',
    ],
  }))

  return NextResponse.json({
    ok: true,
    pending: {
      checked: pending.checked,
      cancelled: pending.cancelled,
      cutoff: pending.cutoff.toISOString(),
    },
    inventoryBefore,
    marketplaces,
    inventory,
  })
}
