export const MATILHA_CONTACT = {
  whatsappDisplay: '(11) 91594-2356',
  whatsappNumber: '5511915942356',
  instagram: 'https://www.instagram.com/matilhaprado/',
  google: 'https://share.google/OcE5O53xqxRPYL1oT',
  waze: 'https://www.waze.com/ul?q=Av.%20%C3%81gua%20Fria%2C%201647%20-%20Santana%2C%20S%C3%A3o%20Paulo%2C%20SP&navigate=yes',
} as const

export function matilhaWhatsAppUrl(message?: string) {
  const base = `https://wa.me/${MATILHA_CONTACT.whatsappNumber}`
  if (!message?.trim()) return base
  return `${base}?text=${encodeURIComponent(message.trim())}`
}
