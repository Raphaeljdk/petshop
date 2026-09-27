import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Matilha Prado',
    short_name: 'Matilha Prado',
    description: 'A loja, os agendamentos e os cuidados do seu pet em um só lugar.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f7fb',
    theme_color: '#102e48',
    categories: ['shopping', 'lifestyle'],
    prefer_related_applications: false,
    icons: [
      { src: '/icons/matilha-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/matilha-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/matilha-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
