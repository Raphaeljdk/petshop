import {describe,expect,test} from 'bun:test'
import {adicionalLiberado,adicionalFinanceiramentePendente,pagamentoRealAprovado,pendenciasFechamento,orderConfereComanda} from '../src/lib/comanda-pagamento-policy'
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

describe('agrupamento e fechamento',()=>{
 const grupo={...venda,total:70,comandaExtrasGrupo:[{precoCentavos:3000},{precoCentavos:4000}]}
 test('aprovação do grupo cobre cada adicional somente se total bater',()=>{
  expect(adicionalLiberado({...extra,venda:null,grupoVenda:grupo})).toBe(true)
  expect(adicionalLiberado({...extra,venda:null,grupoVenda:{...grupo,total:69}})).toBe(false)
  expect(adicionalLiberado({...extra,venda:null,grupoVenda:{...grupo,status:'pendente'}})).toBe(false)
 })
 test('encerramento exige checkout, principal, produtos e execução dos adicionais',()=>{
  const base={principalPago:true,checkoutConcluido:true,extras:[{...extra,status:'realizado'}],produtos:[venda]}
  expect(pendenciasFechamento(base)).toEqual([])
  expect(pendenciasFechamento({...base,principalPago:false})).toHaveLength(1)
  expect(pendenciasFechamento({...base,checkoutConcluido:false})).toHaveLength(1)
  expect(pendenciasFechamento({...base,extras:[extra]})).toHaveLength(1)
  expect(pendenciasFechamento({...base,produtos:[{...venda,status:'pendente'}]})).toHaveLength(1)
 })
 test('order precisa corresponder à venda e ao valor do pagamento',()=>{
  const v={id:'v1',total:70}
  const order={external_reference:'v1',total_amount:'70.00',transactions:{payments:[{amount:'70.00'}]}}
  expect(orderConfereComanda(order,v)).toBe(true)
  expect(orderConfereComanda({...order,external_reference:'v2'},v)).toBe(false)
  expect(orderConfereComanda({...order,total_amount:'1.00'},v)).toBe(false)
  expect(orderConfereComanda({...order,transactions:{payments:[{amount:'1.00'}]}},v)).toBe(false)
 })
})
