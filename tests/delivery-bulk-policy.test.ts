import test from 'node:test'
import assert from 'node:assert/strict'
import { canCompleteLocalDelivery } from '../src/lib/delivery-bulk-policy'

const local={canal:'site',status:'concluida',tipoEntrega:'entrega_propria',statusEntrega:'pendente'}
test('aceita entregas locais pendentes ou enviadas e reexecução não entrega outra vez',()=>{
 assert.equal(canCompleteLocalDelivery(local),true)
 assert.equal(canCompleteLocalDelivery({...local,statusEntrega:'enviada'}),true)
 assert.equal(canCompleteLocalDelivery({...local,statusEntrega:null}),true)
 assert.equal(canCompleteLocalDelivery({...local,statusEntrega:'entregue'}),false)
})
test('nunca marca cancelados, retiradas ou pedidos de marketplace em lote',()=>{
 assert.equal(canCompleteLocalDelivery({...local,status:'cancelada'}),false)
 assert.equal(canCompleteLocalDelivery({...local,tipoEntrega:'retirada'}),false)
 assert.equal(canCompleteLocalDelivery({...local,canal:'mercadolivre',tipoEntrega:'marketplace'}),false)
 assert.equal(canCompleteLocalDelivery({...local,canal:'amazon',tipoEntrega:'marketplace'}),false)
})
test('fretes locais tipo Sedex e Melhor Envio podem ser selecionados',()=>{
 for(const tipoEntrega of ['sedex','melhor_envio'])
  assert.equal(canCompleteLocalDelivery({...local,tipoEntrega}),true)
})
