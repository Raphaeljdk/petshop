import {test} from 'node:test'
import assert from 'node:assert/strict'
import {BLOQUEIO_NUMERACAO_HOMOLOGACAO,bloqueioNumeracaoValido} from '../src/lib/nfe-homologacao-lock'

test('bloqueio usa SELECT boolean e não tenta desserializar retorno void do PostgreSQL',()=>{
  const consulta=BLOQUEIO_NUMERACAO_HOMOLOGACAO
  const sql=consulta.strings.join('?')
  assert.match(sql,/SELECT true AS locked FROM pg_advisory_xact_lock\(\?::bigint\)/i)
  assert.deepEqual(consulta.values,[BigInt('57199062000191')])
  assert.doesNotMatch(sql,/SELECT\s+pg_advisory_xact_lock\(/i)
})
test('bloqueio da numeração requer exatamente uma confirmação positiva',()=>{
  assert.equal(bloqueioNumeracaoValido([{locked:true}]),true)
  assert.equal(bloqueioNumeracaoValido([]),false)
  assert.equal(bloqueioNumeracaoValido([{locked:false}]),false)
  assert.equal(bloqueioNumeracaoValido([{locked:true},{locked:true}]),false)
})
