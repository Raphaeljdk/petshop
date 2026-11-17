export type HelpPosition = { x: number; y: number }
export type HelpSavedPosition = { side: 'left' | 'right'; y: number }

export const HELP_SIZE = 48
export const HELP_MARGIN = 12
export const HELP_TOP = 28
export const HELP_NAV_GAP = 16

/** O limite inferior utiliza o topo REAL da barra mobile, não uma altura fixa. */
export function limitesAjuda(viewWidth: number, navTop: number) {
  return {
    minX: HELP_MARGIN,
    maxX: Math.max(HELP_MARGIN, viewWidth - HELP_SIZE - HELP_MARGIN),
    minY: HELP_TOP,
    maxY: Math.max(HELP_TOP, navTop - HELP_SIZE - HELP_NAV_GAP),
  }
}

export function limitarAjuda(pos: HelpPosition, bounds: ReturnType<typeof limitesAjuda>): HelpPosition {
  const sane = (v: number, fallback: number) => Number.isFinite(v) ? v : fallback
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, sane(pos.x, bounds.maxX))),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, sane(pos.y, bounds.maxY))),
  }
}

export function encaixarAjuda(pos: HelpPosition, bounds: ReturnType<typeof limitesAjuda>) {
  const safe = limitarAjuda(pos, bounds)
  const side: HelpSavedPosition['side'] =
    safe.x - bounds.minX <= bounds.maxX - safe.x ? 'left' : 'right'
  return { position: { x: side === 'left' ? bounds.minX : bounds.maxX, y: safe.y }, saved: { side, y: safe.y } }
}

export function posicionarAjuda(saved: HelpSavedPosition | null, bounds: ReturnType<typeof limitesAjuda>) {
  return limitarAjuda({
    x: saved?.side === 'left' ? bounds.minX : bounds.maxX,
    y: saved?.y ?? bounds.maxY,
  }, bounds)
}

export function lerAjudaSalva(value: string | null): HelpSavedPosition | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return null
    const p = parsed as Partial<HelpSavedPosition>
    if ((p.side !== 'left' && p.side !== 'right') || typeof p.y !== 'number' || !Number.isFinite(p.y)) return null
    return { side: p.side, y: p.y }
  } catch {
    return null
  }
}
