type Consent = { analytics: boolean; ads: boolean }
type EventName = 'view_item' | 'add_to_cart' | 'purchase' | 'booking_request' | 'schedule'
type Payload = { id: string; value?: number; quantity?: number }
const consentKey = 'matilha:medicao:v1'
const dedupKey = 'matilha:conversoes:v1'
const sent = new Set<string>()
const safeId = /^[a-zA-Z0-9_-]{1,100}$/
type Vendors = Window & { gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void }
export function trackingChoices(): Consent {
  try {
    const c = JSON.parse(localStorage.getItem(consentKey) || 'null')
    return { analytics: c?.analytics === true, ads: c?.ads === true }
  } catch {
    return { analytics: false, ads: false }
  }
}
export function saveTrackingChoices(c: Consent) {
  try {
    localStorage.setItem(consentKey, JSON.stringify(c))
    if (!c.analytics && !c.ads) {
      localStorage.removeItem(dedupKey)
      sent.clear()
    }
  } catch {
    return false
  }
  return true
}
// Only send to a configured destination for its consent purpose. No automatic page views,
// contact fields, search text, URLs, order notes, pet names or raw provider responses.
export function trackStoreEvent(name: EventName, p: Payload) {
  if (typeof window === 'undefined' || !safeId.test(p.id)) return
  const conversion = ['purchase', 'booking_request', 'schedule'].includes(name)
  const emit = () => {
    const c = trackingChoices()
    if (!c.analytics && !c.ads) return
    const key = name + ':' + p.id
    if (conversion) {
      let keys: string[] = []
      try {
        const existing = JSON.parse(localStorage.getItem(dedupKey) || '[]')
        if (Array.isArray(existing)) keys = existing
      } catch {}
      if (sent.has(key) || keys.includes(key)) return
      sent.add(key)
      try {
        localStorage.setItem(dedupKey, JSON.stringify([...keys.slice(-249), key]))
      } catch {}
    }
    const commerce = name === 'view_item' || name === 'add_to_cart'
    const data: Record<string, unknown> = {}
    if (commerce)
      data.items = [
        {
          item_id: p.id,
          ...(Number.isSafeInteger(p.quantity) && p.quantity! > 0 ? { quantity: p.quantity } : {}),
        },
      ]
    if (name === 'purchase') data.transaction_id = p.id
    if (typeof p.value === 'number' && Number.isFinite(p.value) && p.value >= 0) {
      data.value = p.value
      data.currency = 'BRL'
    }
    const w = window as Vendors,
      ga = process.env.NEXT_PUBLIC_MATILHA_GA4_ID,
      ads = process.env.NEXT_PUBLIC_MATILHA_ADS_PURCHASE,
      pixel = process.env.NEXT_PUBLIC_MATILHA_META_ID
    // A consent-aware tag manager can subscribe OR use the installed vendor adapters.
    window.dispatchEvent(new CustomEvent('matilha:store-event', { detail: { name, data, consent: c } }))
    if (c.analytics && ga && /^G-[A-Z0-9]+$/.test(ga)) w.gtag?.('event', name, { ...data, send_to: ga })
    if (c.ads && name === 'purchase' && ads && /^AW-\d+\/[\w-]+$/.test(ads))
      w.gtag?.('event', 'conversion', { ...data, send_to: ads })
    if (c.ads && pixel && /^\d+$/.test(pixel)) {
      const meta = {
        view_item: 'ViewContent',
        add_to_cart: 'AddToCart',
        purchase: 'Purchase',
        booking_request: 'Lead',
        schedule: 'Schedule',
      }[name]
      w.fbq?.(
        'trackSingle',
        pixel,
        meta,
        {
          ...(commerce ? { content_ids: [p.id], content_type: 'product' } : {}),
          ...(data.value != null ? { value: data.value, currency: 'BRL' } : {}),
        },
        conversion ? { eventID: key } : undefined,
      )
    }
  }
  if (conversion && navigator.locks)
    void navigator.locks.request('matilha:conversao', emit).catch(() => {})
  else emit()
}
