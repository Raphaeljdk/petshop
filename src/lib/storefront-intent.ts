export type ShopIntent = {
  destination: 'perfil' | 'agendamentos' | 'carrinho' | 'loja' | 'planos' | 'blog'
  id?: string
}
const KEY = 'matilha:vitrine:destino'
export function rememberIntent(intent: ShopIntent | null) {
  try {
    if (intent) sessionStorage.setItem(KEY, JSON.stringify(intent))
    else sessionStorage.removeItem(KEY)
  } catch {
    /* The portal remains accessible with storage disabled. */
  }
}
export function consumeIntent(): ShopIntent | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw)
    if (!['perfil', 'agendamentos', 'carrinho', 'loja', 'planos', 'blog'].includes(value?.destination))
      return null
    return {
      destination: value.destination,
      id: typeof value.id === 'string' ? value.id.slice(0, 150) : undefined,
    }
  } catch {
    return null
  }
}
