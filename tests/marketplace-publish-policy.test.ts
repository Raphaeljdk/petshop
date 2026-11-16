import test from 'node:test'
import assert from 'node:assert/strict'
import {decideMercadoLivreListing,shouldPublishLocalStock} from '../src/lib/marketplace-publish-policy'

test('saldo positivo publica no ERP; zero despublica',()=>{
 assert.equal(shouldPublishLocalStock(1,true),true)
 assert.equal(shouldPublishLocalStock(0,true),false)
 assert.equal(shouldPublishLocalStock(5,false),false)
})
test('ML pausado simples com estoque pode ser reativado',()=>{
 assert.equal(decideMercadoLivreListing(4,{status:'paused',subStatus:['paused_by_seller'],quantity:0}).action,'update-stock-and-activate')
 assert.equal(decideMercadoLivreListing(4,{status:'paused',quantity:4}).action,'activate')
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
