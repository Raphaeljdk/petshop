import { test, expect } from 'bun:test'
import {
  available,
  catalogGroups,
  makeSearchIndex,
  onShelf,
  searchCatalog,
  type ShopProduct,
} from '../src/lib/storefront-catalog'
const make = (
  id: string,
  categoria: string,
  nome: string,
  extra: Partial<ShopProduct> = {},
): ShopProduct => ({
  id,
  nome,
  categoria,
  marca: 'Kong',
  preco: 80,
  precoPromo: null,
  estoque: 2,
  imageUrl: null,
  ...extra,
})
test('classifica somente os grupos sustentados pelo catálogo', () => {
  const p = make('qa', 'PET_FOOD', 'Biscoitos para cães')
  const g = catalogGroups([p]).map((x) => x.id)
  expect(g).toContain('alimentacao')
  expect(g).toContain('cachorros')
  expect(g).not.toContain('gatos')
  expect(g).not.toContain('higiene')
  expect(
    catalogGroups([make('roupa', 'PET_APPAREL', 'Casaco Bonito pra Cachorro')]).map((x) => x.id),
  ).not.toContain('cachorros')
  expect(
    catalogGroups([make('br', 'Dispensadores de Petiscos', 'Brinquedo')]).map((x) => x.id),
  ).not.toContain('petiscos')
})
test('disponibilidade, promoções e novidades vêm do cadastro', () => {
  const p = make('a', 'A', 'A', { createdAt: '2026-11-04T00:00:00Z', precoPromo: 65 })
  expect(available({ ...p, estoque: 0 })).toBe(false)
  expect(available({ ...p, estoque: 0, estoqueIlimitado: true })).toBe(true)
  expect(onShelf(p, 'ofertas')).toBe(true)
  expect(onShelf({ ...p, precoPromo: 90 }, 'ofertas')).toBe(false)
  expect(onShelf(p, 'novidades', Date.parse('2026-11-27'))).toBe(true)
  expect(onShelf(p, 'novidades', Date.parse('2026-12-27'))).toBe(false)
  expect(onShelf(p, 'mais-vendidos')).toBe(false)
})
test('busca por nome, marca e categoria tolera um erro e preserva ordenação numérica', () => {
  const index = makeSearchIndex([
    make('b', 'Brinquedos', 'Corda'),
    make('a', 'Higiene', 'Escova', { preco: 25 }),
  ])
  expect(searchCatalog(index, 'brinqueods', 'relevancia').map((x) => x.id)).toEqual(['b'])
  expect(searchCatalog(index, 'kong', 'menor').map((x) => x.id)).toEqual(['a', 'b'])
  expect(searchCatalog(index, 'escóva', 'relevancia')[0]?.id).toBe('a')
})
