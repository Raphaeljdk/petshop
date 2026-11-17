import { z } from 'zod'

// Guarda fotografias pequenas diretamente em TEXT no Postgres: arquivos
// locais do navegador jamais se transformam em caminhos do servidor Vercel.
export const catalogImageSchema = z.union([
  z.string().url().max(1500).refine((url) => url.startsWith('https://'), 'Use uma URL HTTPS.'),
  z.string().max(210000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Foto JPEG/PNG/WebP inválida.'),
  z.literal(''),
  z.null(),
])

/** Comprime a foto no navegador antes da API; salva como data URL no banco. */
export async function fileToCatalogImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Envie uma imagem JPG, PNG ou WebP.')
  }
  if (file.size > 8_000_000) throw new Error('O arquivo original deve ter até 8 MB.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Não foi possível abrir a imagem.'))
      img.src = url
    })
    for (const limit of [900, 720, 560, 420]) {
      const ratio = Math.min(1, limit / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * ratio))
      canvas.height = Math.max(1, Math.round(img.height * ratio))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Seu navegador não conseguiu preparar a foto.')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.76, 0.6, 0.43]) {
        const data = canvas.toDataURL('image/jpeg', quality)
        if (data.length <= 205000) return data
      }
    }
    throw new Error('Imagem muito grande mesmo após redução. Escolha outra foto.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
