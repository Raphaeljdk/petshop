import {describe,expect,test} from 'bun:test'
import {validarLiberacaoReal,interpretarEstadoReal} from '../src/lib/nfe-real-liberacao'
const config={serie:2,primeiroNumero:5,referenciaNumeracao:'ata teste',referenciaContabil:'parecer teste',referenciaSchema:'schema teste',exclusivo:true}
const chave='1'.repeat(44)
describe('NF-e real: guardas isoladas',()=>{
 test('desativada por padrão',()=>expect(()=>validarLiberacaoReal(config,false)).toThrow())
 test('exige sequência confirmada e exclusiva',()=>{
 expect(()=>validarLiberacaoReal({...config,primeiroNumero:0},true)).toThrow()
 expect(()=>validarLiberacaoReal({...config,exclusivo:false},true)).toThrow()
 expect(validarLiberacaoReal(config,true)).toEqual(config)
 })
 test('não confunde homologação com produção',()=>expect(()=>interpretarEstadoReal(chave,{ambiente:2,chave,codigo:100,protocolo:'1'.repeat(15)})).toThrow())
 test('exige protocolo e chave correspondente',()=>{
 expect(()=>interpretarEstadoReal(chave,{ambiente:1,chave,codigo:100})).toThrow()
 expect(()=>interpretarEstadoReal(chave,{ambiente:1,chave:'2'.repeat(44),codigo:100,protocolo:'1'.repeat(15)})).toThrow()
 expect(interpretarEstadoReal(chave,{ambiente:1,chave,codigo:100,protocolo:'1'.repeat(15)})).toBe('autorizada')
 })
 test('duplicidade e inexistência exigem conciliação',()=>{
 for(const codigo of [204,217,539])expect(interpretarEstadoReal(chave,{ambiente:1,chave,codigo})).toBe('incerta')
 })
})
