import {describe,test,expect} from 'bun:test'
import {createHmac} from 'node:crypto'
import {metaChallenge,metaSignatureValid,extractMetaStatuses,metaDeliveryTransitions} from '../src/lib/meta-whatsapp-webhook'
const token='token-de-teste-apenas-1234567890'
describe('webhook da Meta',()=>{
 test('responde ao desafio apenas com token e modo corretos',()=>{
  const p=new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':token,'hub.challenge':'12345'})
  expect(metaChallenge(p,token)).toBe('12345')
  expect(metaChallenge(p,undefined)).toBeNull()
  expect(metaChallenge(p,'outro-token-de-teste-1234567890')).toBeNull()
  p.set('hub.mode','other');expect(metaChallenge(p,token)).toBeNull()
 })
 test('rejeita assinatura ausente e corpo adulterado',()=>{
  const body=Buffer.from('{"object":"whatsapp_business_account"}')
  const secret='segredo-exclusivo-de-teste'
  const signature='sha256='+createHmac('sha256',secret).update(body).digest('hex')
  expect(metaSignatureValid(body,signature,secret)).toBe(true)
  expect(metaSignatureValid(body,null,secret)).toBe(false)
  expect(metaSignatureValid(Buffer.from('{}'),signature,secret)).toBe(false)
  expect(metaSignatureValid(body,signature,undefined)).toBe(false)
 })
 test('aceita somente status do telefone configurado e não retrocede a leitura',()=>{
  const payload={object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:'phone1'},statuses:[{id:'wamid.test',status:'delivered'},{id:'invalid',status:'unknown'}]}}]}]}
  expect(extractMetaStatuses(payload,'phone1')).toEqual([{id:'wamid.test',status:'delivered'}])
  expect(extractMetaStatuses(payload,'phone2')).toEqual([])
  expect(metaDeliveryTransitions.delivered.from).not.toContain('lido')
  expect(metaDeliveryTransitions.failed.from).not.toContain('entregue')
 })
})
