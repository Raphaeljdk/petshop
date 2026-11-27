import {describe,test,expect} from 'bun:test'
import {gravataPaga,confirmacaoReal} from '../src/lib/gravata-whatsapp-policy'
const booking={clienteId:'c1',status:'confirmado',gravataFoto:'data:image/jpeg;base64,AAAA',gravataPrecoCentavos:500,servicoPrecoCentavos:15000,pagamentoVendaId:'v1'}
const venda={id:'v1',clienteId:'c1',status:'concluida',mercadoPagoStatus:'approved',mercadoPagoId:'ORD-123',total:155}
const order={orderId:'ORD-123',status:'processed',statusDetail:'accredited',raw:{external_reference:'v1',total_amount:'155.00'}}
describe('personalização somente após pagamento integral',()=>{
 test('libera a foto e ideia quando a venda pertence ao tutor e está paga',()=>expect(gravataPaga(booking,venda)).toBe(true))
 test('bloqueia pendência, autorização sem captura, simulação e pagamento parcial',()=>{
  for(const patch of [{status:'pendente'},{mercadoPagoStatus:'authorized'},{mercadoPagoId:'SIM-123'},{total:5},{total:150},{clienteId:'c2'},{id:'v2'}])expect(gravataPaga(booking,{...venda,...patch})).toBe(false)
 })
 test('bloqueia agendamento não confirmado, sem foto ou sem valor oficial',()=>{
  for(const patch of [{status:'solicitado'},{gravataFoto:null},{servicoPrecoCentavos:null},{gravataPrecoCentavos:0}])expect(gravataPaga({...booking,...patch},venda)).toBe(false)
 })
 test('reconsulta a order oficial e confirma referência, total e captura',()=>{
  expect(confirmacaoReal(order,venda)).toBe(true)
  expect(confirmacaoReal({...order,statusDetail:'waiting_capture'},venda)).toBe(false)
  expect(confirmacaoReal({...order,raw:{...order.raw,total_amount:'5.00'}},venda)).toBe(false)
  expect(confirmacaoReal({...order,raw:{...order.raw,external_reference:'outro'}},venda)).toBe(false)
  expect(confirmacaoReal({...order,orderId:'outra'},venda)).toBe(false)
 })
})
