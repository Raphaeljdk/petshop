import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogVariantDetails, catalogVariantInfo, clothingSizeOptions, groupCatalogProducts, isClothingProduct } from '../src/lib/product-variants.ts'

const make = (id, nome, estoque, extra = {}) => ({
  id, nome, estoque, preco: 189.9, precoPromo: null, ...extra,
})

test('título fica somente com o nome base e a cor, nunca com tamanho', () => {
  assert.deepEqual(
    catalogVariantInfo('Vestido Pet Luxo Tweed Laço Lilás Pp, M E G - Mp Lilás M'),
    { title: 'Vestido Pet Luxo Tweed Laço Lilás', size: 'M', color: 'Lilás' },
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

test('a cor após o hífen diferencia anúncios da mesma família', () => {
  const products = groupCatalogProducts([
    make('pink', 'Jaqueta Ursinho - Rosa GG', 1),
    make('blue', 'Jaqueta Ursinho - Azul GG', 2),
  ])
  assert.equal(products.length, 1)
  assert.equal(products[0].variantes?.length, 2)
  assert.equal(products[0].estoque, 3)
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

test('todas as roupas têm uma grade visual P/M/G/GG, mesmo com poucos SKUs reais', () => {
  assert.deepEqual(clothingSizeOptions(['M']), ['P', 'M', 'G', 'GG'])
  assert.deepEqual(clothingSizeOptions([]), ['P', 'M', 'G', 'GG'])
  assert.deepEqual(clothingSizeOptions(['PP', 'G', 'XGG']), ['PP', 'P', 'M', 'G', 'GG', 'XGG'])
  assert.equal(isClothingProduct({ nome: 'Jaqueta Puffer Urso', categoria: 'Pet shop' }), true)
  assert.equal(isClothingProduct({ nome: 'Vestido Pet Lilás', categoria: 'Produtos' }), true)
  assert.equal(isClothingProduct({ nome: 'Capa de chuva amarela', categoria: 'Pets' }), true)
  assert.equal(isClothingProduct({ nome: 'Modelinho exclusivo', categoria: 'Roupas de Inverno' }), true)
  assert.equal(isClothingProduct({ nome: 'Coleira com laço', categoria: 'Acessórios' }), false)
  assert.equal(isClothingProduct({ nome: 'Ração para cães', categoria: 'Alimentos' }), false)
})

test('roupa com somente um tamanho preserva SKU e tamanho no item principal', () => {
  const result = groupCatalogProducts([
    make('real-g', 'Jaqueta de Inverno G', 4, { zettaProCod: 234 }),
  ])
  assert.equal(result.length, 1)
  assert.equal(result[0].nome, 'Jaqueta de Inverno')
  assert.equal(result[0].variacaoLabel, 'G')
  assert.equal(result[0].id, 'real-g')
  assert.equal(result[0].estoque, 4)
  assert.equal(result[0].variantes, undefined)
})

test('roupa sem tamanho conhecido não recebe tamanho de SKU inventado', () => {
  const result = groupCatalogProducts([
    make('unmapped', 'Casaco de Frio para Cães', 7),
  ])
  assert.equal(isClothingProduct(result[0]), true)
  assert.equal(result[0].variacaoLabel, null)
  assert.equal(result[0].estoque, 7)
})

test('brinquedo mordedor agrupa hipopótamo lilás e tubarão azul, sem perder modelo', () => {
  const products = groupCatalogProducts([
    make('hipo', 'Brinquedo Mordedor Pelúcia Emite Som Cães Gatos Pets Leve Lilás Hipopótamo', 2),
    make('tubarao', 'Brinquedo Mordedor Pelúcia Emite Som Cães Gatos Pets Leve Azul-celeste Tubarão', 4),
  ])
  assert.equal(products.length, 1)
  assert.equal(products[0].estoque, 6)
  assert.equal(products[0].variantes?.length, 2)
  assert.deepEqual(
    products[0].variantes?.map((p) => [p.modeloLabel, p.corLabel]),
    [['Hipopótamo', 'Lilás'], ['Tubarão', 'Azul Celeste']],
  )
})

test('três brinquedos catnip ficam em um anúncio principal com três cores', () => {
  const names = ['Laranja', 'Verde', 'Amarelo'].map(
    (cor) => 'Brinquedo P/ Gatos Catnip Erva Natural Bolinha Giratória ' + cor
  )
  const grouped = groupCatalogProducts(names.map((nome, id) => make(String(id), nome, 1)))
  assert.equal(grouped.length, 1)
  assert.equal(grouped[0].variantes?.length, 3)
  assert.deepEqual(
    new Set(grouped[0].variantes?.map((p) => p.corLabel)),
    new Set(['Laranja', 'Verde', 'Amarelo']),
  )
})

test('casinha Coração Cotelê agrupa cores sem agrupar outras casinhas', () => {
  const names = ['Verde', 'Rosa', 'Bege'].map(
    (cor) => 'Casinha Coração Cotelê Verde, Rosa Ou Bege Bonito P Cachorro ' + cor
  )
  const group = groupCatalogProducts([
    ...names.map((nome, id) => make(String(id), nome, 1)),
    make('outro', 'Casinha Estilo Iglu Rosa', 7),
  ])
  assert.equal(group.length, 2)
  const cotele = group.find((p) => p.nome === 'Casinha Coração Cotelê')
  assert.equal(cotele?.variantes?.length, 3)
  assert.equal(cotele?.estoque, 3)
})

test('Donutz com anúncios descritos de maneiras diferentes vira uma família', () => {
  const result = groupCatalogProducts([
    make('rosa', 'Pelúcia Donutz Zippypaws Com Apito Para Cães E Gatos Grande Rosa-chiclete Donutz', 2),
    make('azul', 'Brinquedo Pelúcia Donutz Com Som Zippypaws Azul Para Cães Grandes', 2),
    make('marrom', 'Pelúcia Donutz Zippypaws Com Apito Para Cães E Gatos Grande Marrom Donutz', 1),
  ])
  assert.equal(result.length, 1)
  assert.equal(result[0].variantes?.length, 3)
  assert.equal(result[0].estoque, 5)
})

test('moletom e jaqueta puffer preservam cor e tamanho sem juntar outros modelos', () => {
  const moletom = [
    'Moletom Maxi Sport Marinho Ou Vermelho Cachorro Porte Grande Vermelho/p',
    'Moletom Maxi Sport Marinho Ou Vermelho Cachorro Porte Grande Azul-marinho',
  ]
  assert.deepEqual(
    catalogVariantDetails(moletom[0]),
    {title: 'Moletom Maxi Sport', size: 'P', color: 'Vermelho', model: null},
  )
  const jaquetas = [
    'Jaqueta Puffer Pet Rosa/azul Metalizado Reforçada Cães Gatos Azul-escuro',
    'Jaqueta Puffer Pet Rosa/azul Metalizado Reforçada Cães Gatos Rosa-chiclete',
    'Jaqueta Guia Rosa Perolado',
  ]
  const result = groupCatalogProducts([...moletom, ...jaquetas].map((nome, id) => make(String(id), nome, 1)))
  assert.equal(result.length, 3)
  assert.equal(result.find((p) => p.nome === 'Jaqueta Puffer Pet Metalizado Reforçada')?.variantes?.length, 2)
})

test('SKU igual não torna cores diferentes a mesma variação física', () => {
  const products = groupCatalogProducts([
    make('verde', 'Brinquedo P/ Gatos Catnip Erva Natural Bolinha Giratória Verde', 3, {sku:'789123'}),
    make('laranja', 'Brinquedo P/ Gatos Catnip Erva Natural Bolinha Giratória Laranja', 2, {sku:'789123'}),
  ])
  assert.equal(products[0].estoque, 5)
  assert.equal(products[0].variantes?.length, 2)
})
