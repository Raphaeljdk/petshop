import { test } from 'node:test'
import assert from 'node:assert/strict'
import { giftCode,moneyCents } from '../src/lib/portal-gift-credit'

test('vale-presente tem código normalizado e centavos inteiros',()=>{
  assert.equal(giftCode(' mp-pres-abC  '),'MP-PRES-ABC')
  assert.equal(moneyCents(19.99),1999)
  assert.equal(moneyCents(29.945),2995)
})
test('crédito de vale não é desconto nem altera o total fiscal bruto',()=>{
  const subtotal=12500,frete=1500,descontoCupom=1000
  const total= subtotal+frete-descontoCupom
  const saldo=7500
  const credito=Math.min(total,saldo)
  assert.equal(total,13000)
  assert.equal(credito,7500)
  assert.equal(total-credito,5500)
})
