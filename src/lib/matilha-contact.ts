export const MATILHA_CONTACT = {
  whatsappDisplay: '(11) 91594-2356',
  whatsappNumber: '5511915942356',
  instagram: 'https://www.instagram.com/matilhaprado/',
  google: 'https://share.google/OcE5O53xqxRPYL1oT',
} as const

export function matilhaWhatsAppUrl(message?: string) {
  const base = `https://wa.me/${MATILHA_CONTACT.whatsappNumber}`
  if (!message?.trim()) return base
  return `${base}?text=${encodeURIComponent(message.trim())}`
}
