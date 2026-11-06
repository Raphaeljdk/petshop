import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lerNotaXmlEntrada, planejarImportacaoXml } from '../src/lib/fiscal-xml-entrada'

const chave='35261151799062000191550010000000011000000019'
const item='<det nItem="1"><prod><cProd>FORN-A</cProd><cEAN>7899732118403</cEAN><xProd>Petisco &amp; Mordedor</xProd><NCM>23099090</NCM><CEST>2200100</CEST><uCom>UN</uCom><qCom>2</qCom><vProd>42.50</vProd></prod></det>'
function xml(produto=item,mod='55',cStat='100'){
  return '<?xml version="1.0" encoding="utf-8"?>'+
    '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">'+
    '<NFe><infNFe Id="NFe'+chave+'"><ide><mod>'+mod+'</mod><tpNF>1</tpNF>'+
    '<nNF>1</nNF><serie>1</serie><tpAmb>1</tpAmb></ide>'+
    '<emit><CNPJ>11000000000191</CNPJ><xNome>Distribuidor</xNome></emit>'+
    '<dest><CNPJ>51799062000191</CNPJ></dest>'+produto+'</infNFe></NFe>'+
    '<protNFe><infProt><cStat>'+cStat+'</cStat><chNFe>'+chave+
    '</chNFe></infProt></protNFe></nfeProc>'
}
const produto={id:'p1',nome:'Petisco & Mordedor',sku:'7899732118403',
  gtinFiscal:null,ncm:null,cest:null}

test('lê NF-e 55 com protocolo e CNPJ destinatário, sem copiar valores fiscais de saída',()=>{
  const nota=lerNotaXmlEntrada(xml())
  assert.equal(nota.autorizada,true)
  assert.equal(nota.chave,chave)
  assert.equal(nota.cnpjDestinatario,'51799062000191')
  assert.equal(nota.itens[0].descricao,'Petisco & Mordedor')
  assert.equal(nota.itens[0].ncm,'23099090')
  assert.equal(nota.itens[0].cest,'2200100')
  const plano=planejarImportacaoXml(nota.itens,[produto])
  assert.equal(plano[0].status,'apto')
  assert.deepEqual(plano[0].alteracoes[0].campos,{ncm:'23099090',cest:'2200100',gtinFiscal:'7899732118403'})
  assert.equal(Object.hasOwn(plano[0].alteracoes[0].campos,'cfop'),false)
})
test('preserva produto sem GTIN como pendência de vínculo manual',()=>{
  const nota=lerNotaXmlEntrada(xml(item.replace('7899732118403','SEM GTIN')))
  assert.equal(nota.itens[0].gtin,null)
  assert.equal(planejarImportacaoXml(nota.itens,[produto])[0].status,'sem_vinculo')
})
test('rejeita NFS-e/NFC-e, DTD e XML malformado',()=>{
  assert.throws(()=>lerNotaXmlEntrada(xml(item,'65')), /modelo 55/)
  assert.throws(()=>lerNotaXmlEntrada('<!DOCTYPE x [ <!ENTITY lol SYSTEM "file:///etc/passwd"> ]>'+xml()),/DTD/)
  assert.throws(()=>lerNotaXmlEntrada(xml().replace('</dest>','</emit>')),/Tags XML incompatíveis/)
})
test('não considera autorizada NF-e sem protocolo de autorização válido',()=>{
  assert.equal(lerNotaXmlEntrada(xml(item,'55','110')).autorizada,false)
})
test('não substitui classificação divergente e não une kit à unidade',()=>{
  const nota=lerNotaXmlEntrada(xml())
  assert.equal(planejarImportacaoXml(nota.itens,[{...produto,ncm:'33079000'}])[0].status,'conflito')
  assert.equal(planejarImportacaoXml(nota.itens,[{...produto,nome:'Kit 2x Petisco'}])[0].status,'revisar')
})
test('pede revisão para GTIN inválido e NCM sem 8 dígitos',()=>{
  const invalido=lerNotaXmlEntrada(xml(item.replace('7899732118403','7899732118404')))
  assert.equal(planejarImportacaoXml(invalido.itens,[produto])[0].status,'revisar')
  const ncm=lerNotaXmlEntrada(xml(item.replace('23099090','2309')))
  assert.equal(planejarImportacaoXml(ncm.itens,[produto])[0].status,'revisar')
})
test('um mesmo GTIN repetido na NF-e não atualiza duas vezes',()=>{
  const repetido=xml(item+item.replace('nItem="1"','nItem="2"'))
  const nota=lerNotaXmlEntrada(repetido)
  assert.deepEqual(planejarImportacaoXml(nota.itens,[produto]).map(p=>p.status),['apto','duplicado'])
})

test('aceita GTIN tributável quando cEAN está como SEM GTIN e bloqueia marcador zerado',()=>{
  const trib=item.replace('7899732118403','SEM GTIN</cEAN><cEANTrib>7899732118403')
  const nota=lerNotaXmlEntrada(xml(trib))
  assert.equal(nota.itens[0].gtin,'7899732118403')
  const zerado=lerNotaXmlEntrada(xml(item.replace('7899732118403','0000000000000')))
  assert.equal(planejarImportacaoXml(zerado.itens,[produto])[0].status,'revisar')
})
