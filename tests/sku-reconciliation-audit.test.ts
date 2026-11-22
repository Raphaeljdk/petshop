import { describe,expect,test } from 'bun:test'
import { buildSkuAudit,type AuditProduct } from '../src/lib/sku-reconciliation-audit'

function prod(id:string,sku:string,stock:number,extra:Partial<AuditProduct>={}):AuditProduct{
 return {id,sku,estoque:stock,estoqueHub:stock,nome:'Brinquedo',
   mlItemId:null,amazonAsin:null,ativo:true,...extra}
}
describe('Auditoria sem escrita dos SKUs',()=>{
 test('bloqueia conciliação automática em caso de quantidades diferentes',()=>{
   const a=buildSkuAudit([prod('a','035585111025',1),prod('b','035585111025',8)])
   expect(a.summary.duplicateSkus).toBe(1)
   expect(a.summary.differentStock).toBe(1)
   expect(a.groups[0].status).toBe('physical_count')
 })
 test('preserva zeros à esquerda e separa cores/variações com mesmo código',()=>{
   const a=buildSkuAudit([
     prod('a',' 035585131214 ',2,{nome:'Rosa'}),
     prod('b','035585131214',2,{nome:'Azul'}),
   ])
   expect(a.groups[0].sku).toBe('035585131214')
   expect(a.groups[0].status).toBe('identity_review')
   expect(a.summary.differentNames).toBe(1)
 })
 test('não dá baixa por correspondência de ASIN duplicado com SKUs distintos',()=>{
   const a=buildSkuAudit([
     prod('a','SKU1',2,{amazonAsin:'B00TEST'}),
     prod('b','SKU2',5,{amazonAsin:'B00TEST'}),
   ])
   expect(a.summary.duplicateSkus).toBe(0)
   expect(a.summary.duplicateAsins).toBe(1)
   expect(a.duplicateAsins[0].inconsistentStock).toBe(true)
 })
 test('identifica diferença entre estoque operacional e estoque Hub',()=>{
   const a=buildSkuAudit([
     prod('a','ITEM',2,{estoqueHub:5}),
     prod('b','ITEM',2,{estoqueHub:5}),
   ])
   expect(a.groups[0].status).toBe('physical_count')
   expect(a.summary.hubStockDivergences).toBe(2)
 })
 test('mesmo cadastros aparentemente idênticos continuam exigindo escolha humana',()=>{
   const a=buildSkuAudit([prod('a','SKU',4),prod('b','SKU',4)])
   expect(a.groups[0].status).toBe('identical_mirrors')
   expect(a.groups[0].items).toHaveLength(2)
 })
})
