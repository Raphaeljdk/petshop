import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findKongClassicImage, getProductBrand, MARCA_PERSONALIZAVEIS, recoverCatalogImages, SEM_MARCA } from '../src/lib/product-brands'

test('marca do Zetta prevalece e KONG e reconhecida em diferentes tipos de produto', () => {
  assert.equal(getProductBrand({ nome: 'Bola de borracha para cães', marca: 'Kong' }), 'Kong')
  assert.equal(getProductBrand({ nome: 'Brinquedo interativo KONG Puppy' }), 'Kong')
  assert.equal(getProductBrand({ nome: 'JAMBO PET cama nuvem' }), 'Jambo Pet')
  assert.equal(getProductBrand({ nome: 'Camiseta pet lisa' }), SEM_MARCA)
})

test('fotos sao sugeridas apenas para o mesmo SKU e variante identificavel', () => {
  const rows = [
    { id: 'zetta', nome: 'KONG Puppy Rosa', sku: 'ABC123', imageUrl: null, estoque: 2 },
    { id: 'ml', nome: 'KONG Puppy Rosa', sku: 'ABC123', imageUrl: 'https://cdn.example/rosa.jpg', estoque: 3 },
    { id: 'amazon', nome: 'KONG Puppy Azul', sku: 'ABC123', imageUrl: null, estoque: 4 },
  ]
  const result = recoverCatalogImages(rows)
  assert.equal(result[0].imageUrl, 'https://cdn.example/rosa.jpg')
  assert.equal(result[2].imageUrl, null)
  assert.equal(result[0].estoque, 2)
  assert.deepEqual(rows[0].imageUrl, null)
})

test('fotos conflitantes ficam pendentes sem substituicao automatica', () => {
  const rows = [
    { id: 'z', nome: 'KONG Puppy Rosa', sku: 'ABC123', imageUrl: null },
    { id: 'a', nome: 'KONG Puppy Rosa', sku: 'ABC123', imageUrl: 'https://cdn.example/a.jpg' },
    { id: 'b', nome: 'KONG Puppy Rosa', sku: 'ABC123', imageUrl: 'https://cdn.example/b.jpg' },
  ]
  assert.equal(recoverCatalogImages(rows)[0].imageUrl, null)
})


test('reconhece Great Pet inclusive variantes de grafia e linha Tapetim', () => {
  assert.equal(getProductBrand({ nome: 'Tapete Higiênico Greet Pet 30 unidades' }), 'Great Pet')
  assert.equal(getProductBrand({ nome: 'Tapete Higiênico Great Pets 80x60' }), 'Great Pet')
  assert.equal(getProductBrand({ nome: 'Tapetim 60x60 30 unidades' }), 'Great Pet')
  assert.equal(getProductBrand({ nome: 'Tapete higiênico genérico' }), SEM_MARCA)
})

test('reconhece Bonito pra Cachorro nas roupas e camas mesmo após agrupar variações', () => {
  assert.equal(
    getProductBrand({
      nome: 'Jaqueta Puffer Urso Rosa Ou Azul',
      variantes: [
        { nome: 'Jaqueta Puffer Urso Rosa Ou Azul - Bonito Pra Cachorro Azul-celeste G' },
        { nome: 'Jaqueta Puffer Urso Rosa Ou Azul - Bonito Pra Cachorro Rosa-chiclete M' },
      ],
    }),
    'Bonito pra Cachorro'
  )
  assert.equal(getProductBrand({ nome: 'Cama Retangular Rosa Ou Azul - Bonito Pra Cachorro G Rosa' }), 'Bonito pra Cachorro')
  assert.equal(getProductBrand({ nome: 'Cama Linho Clean Chiclete, Tamanho M' }), 'Bonito pra Cachorro')
  assert.equal(getProductBrand({ nome: 'Moletom Maxi Sport Marinho G' }), 'Bonito pra Cachorro')
  assert.equal(getProductBrand({ nome: 'Casaco Coelho Laço Branco, Tamanho P' }), 'Bonito pra Cachorro')
})

test('não transforma toda roupa ou cama em marca: preserva identificação confiável', () => {
  assert.equal(getProductBrand({ nome: 'Roupa pet lisa sem fabricante' }), SEM_MARCA)
  assert.equal(getProductBrand({ nome: 'Cama pet retangular simples' }), SEM_MARCA)
  assert.equal(getProductBrand({ nome: 'Cama Jambo Pet para gato' }), 'Jambo Pet')
  assert.equal(
    getProductBrand({ nome: 'Cama', marca: 'Fabricante Informado', variantes: [{ nome: 'Cama Bonito Pra Cachorro' }] }),
    'Fabricante Informado'
  )
  assert.equal(
    getProductBrand({ nome: 'Cama', variantes: [{ nome: 'Cama Kong' }, { nome: 'Cama Jambo Pet' }] }),
    SEM_MARCA
  )
})

test('marca Personalizáveis já fica reservada para próximos lançamentos', () => {
  assert.equal(getProductBrand({ nome: 'Coleira Matilha Prado Personalizáveis', marca: MARCA_PERSONALIZAVEIS }), MARCA_PERSONALIZAVEIS)
  assert.equal(getProductBrand({ nome: 'Coleira Matilha Prado personalizados' }), MARCA_PERSONALIZAVEIS)
})

test('miniatura Kong usa brinquedo Classic vermelho real, não outro produto da Kong', () => {
  const products = [
    { nome: 'Kong SqueakAir Bola Amarela', imageUrl: 'https://example.test/bola.jpg' },
    { nome: 'KONG Original Classic Vermelho', imageUrl: 'https://example.test/classic.jpg' },
  ]
  assert.equal(findKongClassicImage(products), 'https://example.test/classic.jpg')
  assert.equal(findKongClassicImage(products.slice(0, 1)), null)
  assert.equal(findKongClassicImage([
    {
      nome: 'Brinquedos Kong',
      imageUrl: 'https://example.test/outro.jpg',
      variantes: [
        { nome: 'Kong Classic Medium Vermelho', imageUrl: 'https://example.test/classic-variante.jpg' },
      ],
    },
  ]), 'https://example.test/classic-variante.jpg')
})
