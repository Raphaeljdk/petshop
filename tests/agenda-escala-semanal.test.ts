import {describe,expect,test} from 'bun:test'
import {diaDaSemana,resolverEscala,dentroDoExpediente,escalaSemanalSchema} from '../src/lib/agenda-escala-semanal'
const base={diaSemana:1,inicio:'09:00',fim:'18:00',turnos:[{profissionalId:'p1',inicio:'09:00',fim:'17:00'}],servicos:[{chave:'banho',profissionais:['p1']}]}
describe('escala semanal',()=>{
 test('recorre todas as segundas sem cadastro por data',()=>{
  for(const dia of ['2026-11-30','2026-12-07','2026-12-14']){
   expect(diaDaSemana(dia)).toBe(1)
   expect(resolverEscala(dia,null,base)?.servicos).toEqual(base.servicos)
  }
 })
 test('fechamento excepcional e dia não cadastrado',()=>{
  expect(resolverEscala('2026-11-30',{servicos:[]},base)?.servicos).toEqual([])
  expect(resolverEscala('2026-11-29',null,null)).toBeNull()
 })
 test('duração inteira deve caber no turno e expediente',()=>{
  const dia='2026-11-30',e=resolverEscala(dia,null,base)!
  const t=(h:string)=>new Date(dia+'T'+h+':00-03:00')
  expect(dentroDoExpediente(dia,t('09:00'),t('11:00'),'p1',e)).toBe(true)
  expect(dentroDoExpediente(dia,t('16:00'),t('17:10'),'p1',e)).toBe(false)
  expect(dentroDoExpediente(dia,t('08:50'),t('09:10'),'p1',e)).toBe(false)
  expect(dentroDoExpediente(dia,t('10:00'),t('11:00'),'p2',e)).toBe(false)
 })
 test('rejeita turno fora do expediente e serviço sem profissional presente',()=>{
  expect(escalaSemanalSchema.safeParse([base]).success).toBe(true)
  expect(escalaSemanalSchema.safeParse([{...base,turnos:[]}]).success).toBe(false)
  expect(escalaSemanalSchema.safeParse([{...base,turnos:[{...base.turnos[0],fim:'19:00'}]}]).success).toBe(false)
 })
})
