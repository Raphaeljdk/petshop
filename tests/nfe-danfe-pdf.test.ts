import {test} from 'node:test'
import assert from 'node:assert/strict'
import {codificarCode128C,gerarDanfePdfAutorizado,DanfeError} from '../src/lib/nfe-danfe-pdf'
const chave='35261157199062000191550020000000011123456789'
const protocolo='135260000000001'
const ns='http://www.portalfiscal.inf.br/nfe'
const end=(rua:string)=>'<xLgr>'+rua+'</xLgr><nro>1</nro><xBairro>Centro</xBairro><cMun>3550308</cMun><xMun>Sao Paulo</xMun><UF>SP</UF><CEP>01001000</CEP>'
const xml='<nfeProc xmlns="'+ns+'" versao="4.00">'+
 '<NFe><infNFe Id="NFe'+chave+'" versao="4.00"><ide><natOp>Venda de mercadoria</natOp><serie>2</serie><nNF>1</nNF><dhEmi>2026-11-19T12:00:00-03:00</dhEmi><tpAmb>1</tpAmb></ide>'+
 '<emit><CNPJ>57199062000191</CNPJ><xNome>Matilha Prado</xNome><enderEmit>'+end('Rua A')+'</enderEmit><IE>111111111</IE></emit>'+
 '<dest><CPF>12345678901</CPF><xNome>Cliente de teste</xNome><enderDest>'+end('Rua B')+'</enderDest></dest>'+
 '<det nItem="1"><prod><cProd>PROD1</cProd><xProd>Produto de teste</xProd><NCM>33061000</NCM><CFOP>5102</CFOP><qCom>1.0000</qCom><vUnCom>136.9000000000</vUnCom><vProd>136.90</vProd></prod></det>'+
 '<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vNF>136.90</vNF></ICMSTot></total></infNFe></NFe>'+
 '<protNFe><infProt><tpAmb>1</tpAmb><chNFe>'+chave+'</chNFe><cStat>100</cStat><nProt>'+protocolo+'</nProt><dhRecbto>2026-11-19T12:00:10-03:00</dhRecbto></infProt></protNFe></nfeProc>'
const nota=()=>({modelo:'55',status:'autorizada',emissor:'matilha_prado',
 chaveAcesso:chave,protocolo,xmlAutorizado:xml})
test('código de barras Code 128 C válido para chave de 44 dígitos',()=>{
 const barras=codificarCode128C(chave)
 assert.match(barras,/^[1-4]+$/)
 assert.equal(barras.endsWith('2331112'),true)
 assert.throws(()=>codificarCode128C('123'),DanfeError)
})
test('DANFE PDF só é gerado com XML nfeProc autorizado em produção',()=>{
 const pdf=gerarDanfePdfAutorizado(nota())
 assert.match(pdf.toString('latin1',0,10),/^%PDF-1\.4/)
 assert.ok(pdf.length>3500)
 assert.match(pdf.toString('latin1'),/Documento Auxiliar/)
 assert.match(pdf.toString('latin1'),/%%EOF/)
})
test('recusa nota de homologação ou protocolo divergente',()=>{
 assert.throws(()=>gerarDanfePdfAutorizado({...nota(),emissor:'mercado_livre'}),DanfeError)
 assert.throws(()=>gerarDanfePdfAutorizado({...nota(),xmlAutorizado:xml.replaceAll('<tpAmb>1</tpAmb>','<tpAmb>2</tpAmb>')}),DanfeError)
 assert.throws(()=>gerarDanfePdfAutorizado({...nota(),xmlAutorizado:xml.replace('<nNF>1</nNF>','<nNF>1</nNF>').replace('<chNFe>'+chave+'</chNFe>','<chNFe>'+'1'.repeat(44)+'</chNFe>')}),DanfeError)
})
