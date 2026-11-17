import test from 'node:test'
import assert from 'node:assert/strict'
import {CHECKIN_SECTIONS,CHECKOUT_SECTIONS,ACEITE_TEXTO,ACEITE_VERSAO,CHECKOUT_ACEITE_TEXTO,CHECKOUT_ACEITE_VERSAO,validarRespostaCheckout,answerCount,sanitizeFormAnswers} from '../src/lib/atendimento-ficha'
import {canAdvanceServiceProcess,requiresFichaAtendimento,unsafeCheckin} from '../src/lib/atendimento-flow'

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
test('aceite do check-out só aceita ação válida e identidade do tutor',()=>{
 assert.match(CHECKOUT_ACEITE_TEXTO,/sem renunciar a direitos/)
 assert.match(CHECKOUT_ACEITE_VERSAO,/checkout/)
 assert.equal(validarRespostaCheckout('aceitar','Maria da Silva',true),null)
 assert.equal(validarRespostaCheckout('discordar','Maria da Silva',false),null)
 assert.match(validarRespostaCheckout('aceitar','Maria da Silva',false)||'',/Confirme/)
 assert.match(validarRespostaCheckout('aceitar','',true)||'',/nome completo/)
 assert.match(validarRespostaCheckout('autorizar','Maria da Silva',true)||'',/Selecione/)
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

test('nenhum aceite autoriza procedimento marcado para suspensão ou avaliação veterinária',()=>{
 assert.equal(unsafeCheckin({chegadaCondicao:'Necessita avaliação veterinária antes do procedimento'}),true)
 assert.equal(unsafeCheckin({checkinComunicacoes:['Procedimento suspenso/não iniciado por segurança']}),true)
 assert.equal(unsafeCheckin({chegadaCondicao:'Sem alterações visíveis'}),false)
})
