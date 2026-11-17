import { describe, expect, test } from 'bun:test'
import { encaixarAjuda, lerAjudaSalva, limitarAjuda, limitesAjuda, posicionarAjuda } from '../src/lib/mobile-whatsapp-position'

describe('WhatsApp móvel: arraste, limites e encaixe', () => {
  const bounds = limitesAjuda(390, 760)
  test('posição inicial fica acima da barra inferior e na lateral direita', () => {
    expect(posicionarAjuda(null, bounds)).toEqual({ x: 330, y: 696 })
  })
  test('nunca permite sobrepor a barra inferior nem sair das laterais', () => {
    expect(limitarAjuda({ x: 1000, y: 2000 }, bounds)).toEqual({ x: 330, y: 696 })
    expect(limitarAjuda({ x: -100, y: -100 }, bounds)).toEqual({ x: 12, y: 28 })
  })
  test('soltar encaixa na borda mais próxima', () => {
    expect(encaixarAjuda({ x: 80, y: 300 }, bounds).saved).toEqual({ side: 'left', y: 300 })
    expect(encaixarAjuda({ x: 300, y: 220 }, bounds).saved).toEqual({ side: 'right', y: 220 })
  })
  test('posição salva é validada e adaptada a tela menor', () => {
    expect(lerAjudaSalva('{"side":"left","y":400}')).toEqual({ side: 'left', y: 400 })
    expect(lerAjudaSalva('{"side":"invalid","y":400}')).toBeNull()
    expect(lerAjudaSalva('{"side":"right","y":"200"}')).toBeNull()
    expect(posicionarAjuda({ side: 'right', y: 1000 }, limitesAjuda(320, 610))).toEqual({ x: 260, y: 546 })
  })
})
