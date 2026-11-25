import {describe,expect,test} from 'bun:test'
import {intervaloFiscal,periodoFiscal} from '../src/lib/fiscal-periodo'
describe('períodos fiscais SP',()=>{
 const agora=new Date('2026-11-25T15:00:00Z')
 test('dia local',()=>{const r=intervaloFiscal('hoje',agora)!;expect(r.gte.toISOString()).toBe('2026-11-25T03:00:00.000Z');expect(r.lt.toISOString()).toBe('2026-11-26T03:00:00.000Z')})
 test('semana segunda a domingo',()=>{const r=intervaloFiscal('semana',agora)!;expect(r.gte.toISOString()).toBe('2026-11-23T03:00:00.000Z');expect(r.lt.toISOString()).toBe('2026-11-30T03:00:00.000Z')})
 test('mês',()=>{const r=intervaloFiscal('mes',agora)!;expect(r.gte.toISOString()).toBe('2026-11-01T03:00:00.000Z');expect(r.lt.toISOString()).toBe('2026-12-01T03:00:00.000Z')})
 test('antes da meia-noite local',()=>expect(intervaloFiscal('hoje',new Date('2026-11-25T02:59:59Z'))!.gte.toISOString()).toBe('2026-11-24T03:00:00.000Z'))
 test('recentes',()=>expect(intervaloFiscal(periodoFiscal(null),agora)).toBeUndefined())
})
