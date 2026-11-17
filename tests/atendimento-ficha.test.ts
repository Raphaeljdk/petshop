import test from 'node:test'
import assert from 'node:assert/strict'
import {CHECKIN_SECTIONS,CHECKOUT_SECTIONS,ACEITE_TEXTO,ACEITE_VERSAO,answerCount,sanitizeFormAnswers} from '../src/lib/atendimento-ficha'
import {canAdvanceServiceProcess,requiresFichaAtendimento} from '../src/lib/atendimento-flow'

test('modelo contempla as secoes de check-in e check-out e versao do aceite',()=>{
 assert.equal(CHECKIN_SECTIONS.length,9)
 assert.equal(CHECKOUT_SECTIONS.length,9)
 assert.ok(CHECKIN_SECTIONS.flatMap(s=>s.fields).length>=65)
 assert.ok(CHECKOUT_SECTIONS.flatMap(s=>s.fields).length>=50)
 assert.ok(ACEITE_TEXTO.includes('não substitui avaliação veterinária'))
 assert.ok(ACEITE_VERSAO.includes('v1'))
})
test('não permite campos ou opções arbitrárias e preserva "não avaliado"',()=>{
 assert.deepEqual(sanitizeFormAnswers('checkin',{saude1:'Não informado',pele1:'Não avaliado',peleRegioes:['Patas']}),{
  saude1:'Não informado',pele1:'Não avaliado',peleRegioes:['Patas'],
 })
 assert.throws(()=>sanitizeFormAnswers('checkin',{coisaInexistente:'x'}))
 assert.throws(()=>sanitizeFormAnswers('checkin',{saude1:'Diagnóstico veterinário'}))
 assert.throws(()=>sanitizeFormAnswers('checkout',{saidaChecklist:['Procedimento não listado']}))
 assert.equal(answerCount({saude1:'Sim',peleRegioes:[],saude2:''}),1)
})
test('novo banho precisa de aceite e checkout, histórico legado preservado',()=>{
 assert.equal(requiresFichaAtendimento('Banho e Tosa'),true)
 assert.equal(requiresFichaAtendimento('Spa Pet'),true)
 assert.equal(requiresFichaAtendimento('Consulta veterinária'),false)
 assert.match(canAdvanceServiceProcess({requiresFicha:true,status:'em_andamento',checkinStatus:'pendente_aceite'})||'',/tutor/)
 assert.match(canAdvanceServiceProcess({requiresFicha:true,status:'finalizado',checkinStatus:'aceito'})||'',/check-out/)
 assert.equal(canAdvanceServiceProcess({requiresFicha:true,status:'finalizado',checkinStatus:'aceito',checkoutCompleted:true}),null)
 assert.equal(canAdvanceServiceProcess({requiresFicha:false,status:'finalizado'}),null)
})
