import {describe,expect,test} from 'bun:test'
import {calcularDVChaveNfe,interpretarChaveNfe} from '../src/lib/fiscal-chave'
const cnpj='12345678000195'
const base='35'+'2610'+cnpj+'55'+'001'+'000001234'+'1'+'87654321'
const chave=base+calcularDVChaveNfe(base)
describe('Conciliação manual de NF-e externa',()=>{
  test('exige 44 dígitos e DV calculado pelo módulo 11',()=>{
    expect(chave).toHaveLength(44)
    expect(interpretarChaveNfe(chave,cnpj)).toEqual({
      chaveAcesso:chave,cnpj,modelo:'55',serie:1,numero:1234,
    })
    expect(()=>interpretarChaveNfe(chave.slice(0,-1)+'9',cnpj)).toThrow()
  })
  test('não permite registrar nota de outro CNPJ',()=>{
    expect(()=>interpretarChaveNfe(chave,'99999999000199')).toThrow()
  })
  test('bloqueia qualquer modelo estranho ou série inválida',()=>{
    const wrong=base.slice(0,20)+'57'+base.slice(22)
    expect(()=>interpretarChaveNfe(wrong+calcularDVChaveNfe(wrong),cnpj)).toThrow()
  })
})
