import test from 'node:test'
import assert from 'node:assert/strict'
import {decideMercadoLivreListing,shouldPublishLocalStock} from '../src/lib/marketplace-publish-policy'
import {stockWritesEnabled,hubChangeNeedsMarketplaceSync,quantityToPublishFromHub} from '../src/lib/marketplace-stock-safety'

test('saldo positivo publica no ERP; zero despublica',()=>{
 assert.equal(shouldPublishLocalStock(1,true),true)
 assert.equal(shouldPublishLocalStock(0,true),false)
 assert.equal(shouldPublishLocalStock(5,false),false)
})
test('ML pausado pelo vendedor nao pode ser reativado por sync automatica',()=>{
 assert.equal(decideMercadoLivreListing(4,{status:'paused',subStatus:['paused_by_seller'],quantity:0}).action,'none')
 assert.equal(decideMercadoLivreListing(4,{status:'paused',quantity:4}).action,'none')
})
test('escritas nos marketplaces dependem de opt-in explicito',()=>{
 assert.equal(stockWritesEnabled(undefined),false)
 assert.equal(stockWritesEnabled('false'),false)
 assert.equal(stockWritesEnabled('1'),false)
 assert.equal(stockWritesEnabled('true'),true)
})
test('ML sem estoque nao recebe ativacao e atualiza quantidade de anuncio ativo',()=>{
 assert.equal(decideMercadoLivreListing(0,{status:'paused',quantity:0}).action,'none')
 assert.equal(decideMercadoLivreListing(0,{status:'active',quantity:8}).action,'update-stock')
})
test('moderacoes e estados fechados nao sao reativados',()=>{
 for(const status of ['closed','under_review','inactive','not_yet_active'])
  assert.equal(decideMercadoLivreListing(5,{status,quantity:0}).action,'blocked')
 assert.equal(decideMercadoLivreListing(5,{status:'paused',quantity:1,tags:['moderation_penalty']}).action,'blocked')
 assert.equal(decideMercadoLivreListing(5,{status:'paused',quantity:1,subStatus:['held']}).action,'blocked')
})
test('listagem ativa e estoque igual nao gera PUT desnecessario',()=>{
 assert.equal(decideMercadoLivreListing(2,{status:'active',quantity:2}).action,'none')
})

test('Hub envia estoque confirmado para anúncios vinculados e ignora edição de preço',()=>{
 const before={estoque:5,ativo:true,sku:'SKU-123',mlItemId:'MLB10',amazonAsin:'B00TEST'}
 assert.equal(hubChangeNeedsMarketplaceSync(before,{...before,estoque:2}),true)
 assert.equal(hubChangeNeedsMarketplaceSync(before,{...before,ativo:false}),true)
 assert.equal(hubChangeNeedsMarketplaceSync(before,before),false)
 assert.equal(hubChangeNeedsMarketplaceSync({...before,mlItemId:null,amazonAsin:null},
   {...before,estoque:8,mlItemId:null,amazonAsin:null}),false)
})
test('produto descontinuado no Hub anuncia zero, mesmo se estoque interno for positivo',()=>{
 assert.equal(quantityToPublishFromHub({estoque:8,ativo:false}),0)
 assert.equal(quantityToPublishFromHub({estoque:8,ativo:true}),8)
 assert.equal(quantityToPublishFromHub({estoque:0,ativo:true}),0)
})
test('a reativação no Mercado Livre exige ação explícita do gestor e estoque positivo',()=>{
 const paused={status:'paused',subStatus:['paused_by_seller'],quantity:0}
 assert.equal(decideMercadoLivreListing(3,paused).action,'none')
 assert.equal(decideMercadoLivreListing(3,paused,{explicitAdminActivation:true}).action,
   'update-stock-and-activate')
 assert.equal(decideMercadoLivreListing(0,paused,{explicitAdminActivation:true}).action,'none')
})
