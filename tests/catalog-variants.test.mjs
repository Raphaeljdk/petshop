import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogVariantInfo, groupCatalogProducts } from '../src/lib/product-variants.ts'

const make = (id, nome, estoque, extra = {}) => ({
  id, nome, estoque, preco: 189.9, precoPromo: null, ...extra,
})

test('título fica somente com o nome base e a cor, nunca com tamanho', () => {
  assert.deepEqual(
    catalogVariantInfo('Vestido Pet Luxo Tweed Laço Lilás Pp, M E G - Mp Lilás M'),
    { title: 'Vestido Pet Luxo Tweed Laço Lilás', size: 'M', color: null },
  )
  assert.equal(catalogVariantInfo('Vestido Pet Luxo Tweed Laço Lilás GG').title,
    'Vestido Pet Luxo Tweed Laço Lilás')
  assert.equal(catalogVariantInfo('Vestido Pet Luxo Tweed Laço Lilás').title,
    'Vestido Pet Luxo Tweed Laço Lilás')
  assert.equal(catalogVariantInfo('Coleira de Passeio Azul Tam. PP').title,
    'Coleira de Passeio Azul')
})

test('títulos com duas cores viram um mesmo produto com cor selecionável', () => {
  const azul = catalogVariantInfo('Jaqueta Puffer Urso Rosa Ou Azul - Bonito Pra Cachorro Azul-celeste')
  const rosa = catalogVariantInfo('Jaqueta Puffer Urso Rosa Ou Azul - Bonito Pra Cachorro Rosa-chiclete Gg')
  assert.deepEqual(azul, { title: 'Jaqueta Puffer Urso', size: null, color: 'Azul Celeste' })
  assert.deepEqual(rosa, { title: 'Jaqueta Puffer Urso', size: 'GG', color: 'Rosa Chiclete' })
  const products = groupCatalogProducts([
    make('azul', 'Jaqueta Puffer Urso Rosa Ou Azul - Bonito Pra Cachorro Azul-celeste', 1),
    make('rosa', 'Jaqueta Puffer Urso Rosa Ou Azul - Bonito Pra Cachorro Rosa-chiclete Gg', 1),
  ])
  assert.equal(products.length, 1)
  assert.equal(products[0].nome, 'Jaqueta Puffer Urso')
  assert.equal(products[0].variantes?.length, 2)
  assert.equal(products[0].estoque, 2)
})

test('uma única variação ainda recebe título limpo', () => {
  const products = groupCatalogProducts([make('p', 'Vestido Pet Luxo Tweed Laço Lilás P', 1)])
  assert.equal(products[0].nome, 'Vestido Pet Luxo Tweed Laço Lilás')
  assert.equal(products[0].variantes, undefined)
})

test('um anúncio repetido em dois marketplaces não multiplica estoque', () => {
  const products = groupCatalogProducts([
    make('ml-m', 'Vestido Pet Luxo Tweed Laço Lilás M', 15, { mlItemId: 'MLB1' }),
    make('zetta-m', 'Vestido Pet Luxo Tweed Laço Lilás M', 3, { zettaProCod: 100 }),
    make('zetta-g', 'Vestido Pet Luxo Tweed Laço Lilás G', 2, { zettaProCod: 101 }),
  ])
  assert.equal(products.length, 1)
  assert.equal(products[0].estoque, 5)
  assert.equal(products[0].variantes?.length, 2)
  assert.ok(products[0].variantes?.some((v) => v.id === 'zetta-m'))
  assert.ok(!products[0].variantes?.some((v) => v.id === 'ml-m'))
})

test('sem tamanho, anúncio repetido é um único produto e mantém maior preço', () => {
  const products = groupCatalogProducts([
    make('ml1', 'Jaqueta Ursinho - Produto para cachorro', 5, { preco: 99 }),
    make('ml2', 'Jaqueta Ursinho - Oferta especial', 8, { preco: 109 }),
  ])
  assert.equal(products.length, 1)
  assert.equal(products[0].nome, 'Jaqueta Ursinho')
  assert.equal(products[0].id, 'ml2')
  assert.equal(products[0].estoque, 8)
})
