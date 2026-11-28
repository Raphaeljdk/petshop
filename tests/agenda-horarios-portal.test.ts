import {describe,expect,test} from 'bun:test'
import {diaBrasilia,horariosDoDia,horarioNoIntervalo,horarioSolicitavel} from '../src/lib/agenda-horarios-portal'
describe('horários do portal',()=>{
 const agora=new Date('2026-12-01T10:03:00-03:00')
 test('sugere somente horários futuros de dez em dez minutos',()=>{
  const h=horariosDoDia('2026-12-01',agora)
  expect(h.slice(0,6)).toEqual(['10:10','10:20','10:30','10:40','10:50','11:00'])
  expect(h.at(-1)).toBe('23:50')
  expect(horariosDoDia('2026-12-02',agora)).toHaveLength(144)
 })
 test('recusa minutos avulsos, segundos e data inválida',()=>{
  for(const s of ['10:03:00','10:10:01','10:10:00.001'])expect(horarioNoIntervalo(new Date('2026-12-01T'+s+'-03:00'))).toBe(false)
  expect(horarioNoIntervalo(new Date('2026-12-01T10:10:00-03:00'))).toBe(true)
  expect(horarioNoIntervalo(new Date('invalid'))).toBe(false)
 })
 test('respeita data local e limite de 180 dias',()=>{
  expect(diaBrasilia(new Date('2026-12-01T01:00:00Z'))).toBe('2026-11-30')
  expect(horariosDoDia('2026-11-30',agora)).toEqual([])
  expect(horariosDoDia('2026-02-30',agora)).toEqual([])
  expect(horariosDoDia('2027-12-01',agora)).toEqual([])
  expect(horarioSolicitavel(agora,agora)).toBe(false)
 })
})
