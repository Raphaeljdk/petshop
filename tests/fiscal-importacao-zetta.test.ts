import {test} from 'node:test'
import assert from 'node:assert/strict'
import {lerCsvFiscalZetta,gtinValido,simularImportacaoFiscalZetta} from '../src/lib/fiscal-importacao-zetta'

const item={id:'p-1',sku:'7899732118403',nome:'Buddy Nutrition Esconde Comprimidos',
 zettaProCod:2791,ncm:null,cest:null,gtinFiscal:null,origem:null}
const csv='GTIN;PRO_COD;NCM;CEST;Origem;Descricao;CFOP;CSOSN\\n7899732118403;2791;23099090;;0;Buddy Nutrition Esconde Comprimidos;6102;000\\n'
test('le CSV do Zetta preservando GTIN e ignorando impostos de compra',()=>{
 const rows=lerCsvFiscalZetta(csv)
 assert.equal(rows.length,1);assert.equal(rows[0].gtin,'7899732118403')
 assert.equal(rows[0].camposDeVendaInformados,true)
 const p=simularImportacaoFiscalZetta(rows,[item])[0]
 assert.equal(p.status,'apto')
 assert.deepEqual(p.alteracoes[0].campos,{ncm:'23099090',origem:'0',gtinFiscal:'7899732118403'})
 assert.equal('cfop' in p.alteracoes[0].campos,false)
 assert.equal('csosn' in p.alteracoes[0].campos,false)
})
test('identifica GTIN com 0 inicial e rejeita dígito verificador inválido',()=>{
 assert.equal(gtinValido('035585111117'),true)
 assert.equal(gtinValido('035585111118'),false)
})
test('bloqueia conflito de NCM sem sobrescrever',()=>{
 const p=simularImportacaoFiscalZetta(lerCsvFiscalZetta(csv),[{...item,ncm:'33079000'}])[0]
 assert.equal(p.status,'conflito')
})
test('não associa apenas nome semelhante sem GTIN ou pro_cod',()=>{
 const c='GTIN;NCM;Descricao\\n7899732118403;23099090;Buddy Nutrition Esconde Comprimidos\\n'
 const p=simularImportacaoFiscalZetta(lerCsvFiscalZetta(c),[{...item,sku:'1234567890123',zettaProCod:null}])[0]
 assert.equal(p.status,'sem_vinculo')
})
test('recusa anúncio de kit diferente e código inválido',()=>{
 const p=simularImportacaoFiscalZetta(lerCsvFiscalZetta(csv),[{...item,nome:'KIT 2x Buddy Nutrition'}])[0]
 assert.equal(p.status,'revisar')
 const bad=simularImportacaoFiscalZetta(lerCsvFiscalZetta('GTIN;NCM\\n7899732118404;23099090'),[item])[0]
 assert.equal(bad.status,'revisar')
})
test('evita repetir linha de mesmo código fiscal',()=>{
 const repeat=lerCsvFiscalZetta(csv+csv.split('\\n')[1]+'\\n')
 const r=simularImportacaoFiscalZetta(repeat,[item])
 assert.equal(r[0].status,'apto')
 assert.equal(r[1].status,'duplicado')
})
