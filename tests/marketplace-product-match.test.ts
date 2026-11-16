import test from 'node:test'
import assert from 'node:assert/strict'
import { pickMarketplaceProduct } from '../src/lib/marketplace-product-match'

const candidates=[
  {id:'P',sku:'P-ROSA',mlItemId:'MLB100',amazonAsin:'ASIN-P'},
  {id:'G',sku:'G-AZUL',mlItemId:'MLB100',amazonAsin:'ASIN-G'},
]
test('ML com varias variacoes escolhe somente o SKU exato, nunca o item_id generico',()=>{
  assert.equal(pickMarketplaceProduct(candidates,'mercadolivre',
    {sku:'G-AZUL',externalProductId:'MLB100'})?.id,'G')
  assert.equal(pickMarketplaceProduct(candidates,'mercadolivre',
    {externalProductId:'MLB100'}),null)
})
test('Amazon usa SKU exato mesmo com ASIN fornecido',()=>{
  assert.equal(pickMarketplaceProduct(candidates,'amazon',
    {sku:'P-ROSA',externalProductId:'ASIN-G'})?.id,'P')
})
test('SKU duplicado nao vira baixa fisica ambigua',()=>{
  const withDuplicates=[...candidates,{id:'clone',sku:'P-ROSA',mlItemId:'MLB200',amazonAsin:null}]
  assert.equal(pickMarketplaceProduct(withDuplicates,'mercadolivre',{sku:'P-ROSA'}),null)
})


test('SKU repetido entre ML e Amazon usa ASIN específico para baixar produto correto',()=>{
 const mirrors=[
  {id:'ML-1',sku:'7899732118397',mlItemId:'MLB5433492057',amazonAsin:null},
  {id:'AMZ-1',sku:'7899732118397',mlItemId:null,amazonAsin:'B0FMYTB1DX'},
  {id:'ML-2',sku:'7899732118397',mlItemId:'MLB5433492089',amazonAsin:null},
 ]
 assert.equal(pickMarketplaceProduct(mirrors,'amazon',{
  sku:'7899732118397',externalProductId:'B0FMYTB1DX'
 })?.id,'AMZ-1')
 assert.equal(pickMarketplaceProduct(mirrors,'mercadolivre',{
  sku:'7899732118397',externalProductId:'MLB5433492089'
 })?.id,'ML-2')
 assert.equal(pickMarketplaceProduct(mirrors,'amazon',{
  sku:'7899732118397',externalProductId:'B000000000'
 }),null)
 assert.equal(pickMarketplaceProduct(mirrors,'amazon',{
  sku:'7899732118397'
 }),null)
})
