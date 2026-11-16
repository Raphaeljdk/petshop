import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getProductBrand, recoverCatalogImages, SEM_MARCA } from '../src/lib/product-brands'

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

test('reconhece marcas nas camas, roupas, areias, bolinhas e banho a seco', () => {
  assert.equal(getProductBrand({ nome: 'Cama Retangular - Bonito Pra Cachorro M' }), 'Bonito Pra Cachorro')
  assert.equal(getProductBrand({ nome: 'Casinhas Bonito Para Cachorro' }), 'Bonito Pra Cachorro')
  assert.equal(getProductBrand({ nome: 'Areia Sílica Grossa 1,6kg Great Pets' }), 'Great Pets')
  assert.equal(getProductBrand({ nome: 'Bola Strong Ball Roxa Jambo' }), 'Jambo Pet')
  assert.equal(getProductBrand({ nome: 'Banho A Seco Espuma De Limpeza P/ Cachorros Arm And Hammer' }), 'Arm & Hammer')
  assert.equal(getProductBrand({ nome: 'Camiseta sem identificação' }), SEM_MARCA)
})
