import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gerarContribuicao } from '../src/lib/nfe-homologacao/contribuicoes'
import { validarXsdHomologacao } from '../src/lib/nfe-homologacao/xsd'

for (const nome of ['PIS','COFINS'] as const) {
  test(nome+' CST49 percentual exige cálculo explícito', () => {
    const r = gerarContribuicao(nome,{modalidade:'percentual',cst:'49',base:'100.00',aliquota:'1.6500',valor:'1.65'})
    assert.ok(r.xml.includes('<'+nome+'Outr>'))
    assert.equal(r.centavos,BigInt(165))
    assert.throws(()=>gerarContribuicao(nome,{modalidade:'percentual',cst:'49',base:'100.00',aliquota:'1.6500',valor:'0.00'}))
  })
  test(nome+' CST49 por quantidade e arredondamento', () => {
    const r=gerarContribuicao(nome,{modalidade:'quantidade',cst:'49',quantidade:'3.0000',aliquotaReais:'0.1250',valor:'0.38'})
    assert.equal(r.centavos,BigInt(38))
    assert.ok(r.xml.includes('<qBCProd>3.0000</qBCProd>'))
  })
  test(nome+' não converte CST49 em NT nem aceita dados omitidos', () => {
    assert.throws(()=>gerarContribuicao(nome,{modalidade:'nao-tributada',cst:'49'} as never))
    assert.throws(()=>gerarContribuicao(nome,{modalidade:'percentual',cst:'49'} as never))
  })
}
test('XSD oficial valida consulta de homologação e rejeita ambiente inválido', async()=>{
  const xml='<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>2</tpAmb><xServ>CONSULTAR</xServ><chNFe>35261012345678000195550010000000011000000010</chNFe></consSitNFe>'
  assert.equal((await validarXsdHomologacao(xml,'consulta')).valido,true)
  assert.equal((await validarXsdHomologacao(xml.replace('<tpAmb>2','<tpAmb>9'),'consulta')).valido,false)
})
test('DTD e entidade externa são bloqueadas antes da validação', async()=>{
  await assert.rejects(validarXsdHomologacao('<!DOCTYPE NFe SYSTEM "file:///etc/passwd"><NFe/>'))
})
