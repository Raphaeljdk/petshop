import { test, expect } from 'bun:test'
import { PREFIXO_IBGE_UF, municipioCoerenteComUf, cfopRevendaPorDestino } from '../src/lib/nfe-destino'
test('UF e prefixo IBGE para todos os estados e DF',()=>{
 expect(Object.keys(PREFIXO_IBGE_UF)).toHaveLength(27)
 for(const [uf,prefixo] of Object.entries(PREFIXO_IBGE_UF)){
  expect(municipioCoerenteComUf(uf,prefixo+'12345')).toBe(true)
  expect(municipioCoerenteComUf(uf,'0012345')).toBe(false)
 }
 expect(municipioCoerenteComUf('PR','4106902')).toBe(true)
 expect(municipioCoerenteComUf('PE','2611606')).toBe(true)
 expect(municipioCoerenteComUf('SP','4106902')).toBe(false)
 expect(municipioCoerenteComUf('XX','4106902')).toBe(false)
 expect(municipioCoerenteComUf('PR','410690')).toBe(false)
})
test('CFOP de revenda por destino sem conversão de operações especiais',()=>{
 for(const cfop of ['5102','6102']){
  expect(cfopRevendaPorDestino(cfop,'SP')).toBe('5102')
  expect(cfopRevendaPorDestino(cfop,'PR')).toBe('6102')
  expect(cfopRevendaPorDestino(cfop,'PE')).toBe('6102')
 }
 expect(()=>cfopRevendaPorDestino('5405','PE')).toThrow()
 expect(()=>cfopRevendaPorDestino('5102','XX')).toThrow()
})
