import { describe, expect, test } from 'bun:test'
import { getProductBrand, SEM_MARCA } from '../src/lib/product-brands'

describe('marcas reais identificadas sem alterar produtos', () => {
  test('Bonito Pra Cachorro: cama, roupa e casinha', () => {
    expect(getProductBrand({nome:'Cama Retangular Rosa - Bonito Pra Cachorro M'})).toBe('Bonito Pra Cachorro')
    expect(getProductBrand({nome:'Casinha - Bonito Para Cachorro'})).toBe('Bonito Pra Cachorro')
    expect(getProductBrand({nome:'Jaqueta - Bonito P Cachorro Rosa'})).toBe('Bonito Pra Cachorro')
  })
  test('Great Pets, Jambo e Arm & Hammer', () => {
    expect(getProductBrand({nome:'Areia Sílica Fina Great Pets 1,6kg'})).toBe('Great Pets')
    expect(getProductBrand({nome:'Bola Strong Ball Roxa Jambo'})).toBe('Jambo Pet')
    expect(getProductBrand({nome:'Banho A Seco Espuma De Limpeza P/ Cachorros Arm And Hammer'})).toBe('Arm & Hammer')
  })
  test('não supõe marca quando não há evidência', () => {
    expect(getProductBrand({nome:'Bola de borracha 4cm'})).toBe(SEM_MARCA)
  })
})
