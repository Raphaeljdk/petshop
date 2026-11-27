import { test, expect } from 'bun:test'
import { conferirVinculoExterno, lerNfeExterna, normalizarSkuNfe } from '../src/lib/nfe-externa-conciliacao'
const nota={documento:'12345678909',itens:[{sku:'0742797096780',quantidade:1}],totalCentavos:10939}
const venda={documentos:['123.456.789-09',null],total:109.39,itens:[{sku:'742797096780',quantidade:1}]}
test('aceita vínculo com documento, total e SKU normalizado',()=>{
 expect(()=>conferirVinculoExterno(nota,venda)).not.toThrow()
 expect(normalizarSkuNfe('ABC-001')).toBe('ABC-001')
})
test('bloqueia comprador ausente, divergente ou itens incompatíveis',()=>{
 expect(()=>conferirVinculoExterno(nota,{...venda,documentos:[null]})).toThrow('CPF/CNPJ')
 expect(()=>conferirVinculoExterno(nota,{...venda,documentos:['12345678909','11111111111']})).toThrow('CPF/CNPJ')
 expect(()=>conferirVinculoExterno(nota,{...venda,total:109.59})).toThrow('Total')
 expect(()=>conferirVinculoExterno(nota,{...venda,itens:[{sku:'742797096780',quantidade:2}]})).toThrow('Itens')
})
test('rejeita XML sem protocolo e XML com entidades externas',()=>{
 expect(()=>lerNfeExterna('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>','11222333000181')).toThrow()
 expect(()=>lerNfeExterna('<NFe xmlns="http://www.portalfiscal.inf.br/nfe"/>','11222333000181')).toThrow()
})
