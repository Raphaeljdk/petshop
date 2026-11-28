import {describe,expect,test} from 'bun:test'
import {adicionalLiberado,adicionalFinanceiramentePendente,pagamentoRealAprovado} from '../src/lib/comanda-pagamento-policy'
const venda={total:30,status:'concluida',mercadoPagoStatus:'approved',mercadoPagoId:'ORD-real'}
const extra={status:'autorizado',precoCentavos:3000,aceitoPorId:'tutor',equipePorId:'equipe',venda}
describe('liberação de serviços adicionais',()=>{
 test('aceite sozinho não libera serviço pago',()=>{
  expect(adicionalLiberado({...extra,venda:null})).toBe(false)
  expect(adicionalFinanceiramentePendente({...extra,venda:null})).toBe(true)
 })
 test('pagamento aprovado exige valor exato, status e identificação real',()=>{
  expect(adicionalLiberado(extra)).toBe(true)
  expect(adicionalFinanceiramentePendente(extra)).toBe(false)
  for(const v of [{...venda,total:29.99},{...venda,status:'pendente'},{...venda,mercadoPagoStatus:'pending'},{...venda,mercadoPagoId:'SIM-1'},{...venda,mercadoPagoId:'SIM_1'},{...venda,mercadoPagoId:null}])expect(pagamentoRealAprovado(v,3000)).toBe(false)
 })
 test('recusa, ausência de aceite e falta de confirmação da equipe bloqueiam execução',()=>{
  expect(adicionalLiberado({...extra,status:'recusado'})).toBe(false)
  expect(adicionalLiberado({...extra,aceitoPorId:null})).toBe(false)
  expect(adicionalLiberado({...extra,equipePorId:null})).toBe(false)
  expect(adicionalFinanceiramentePendente({...extra,status:'recusado',venda:null})).toBe(false)
 })
 test('adicional gratuito não gera cobrança, mas exige os dois aceites',()=>{
  expect(adicionalLiberado({...extra,precoCentavos:0,venda:null})).toBe(true)
  expect(adicionalLiberado({...extra,precoCentavos:0,venda:null,equipePorId:null})).toBe(false)
 })
})
