import { describe, test, expect } from 'bun:test'
import { SEFAZ_SP, soapStatusNfeSp, interpretarRespostaStatusSefaz, lerA1DeVariaveis } from '../src/lib/sefaz-sp-nfe'

describe('SEFAZ-SP direto: homologação estritamente sem emissão', () => {
  test('usa os endereços oficiais de NF-e 55 sem host controlado pelo usuário', () => {
    expect(SEFAZ_SP.homologacao.status).toBe('https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx')
    expect(SEFAZ_SP.producao.autorizacao).toBe('https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx')
  })
  test('SOAP de teste usa StatusServico, tpAmb 2 e cUF 35; nunca contém NF-e', () => {
    const xml=soapStatusNfeSp()
    expect(xml).toContain('<consStatServ versao="4.00"')
    expect(xml).toContain('<tpAmb>2</tpAmb><cUF>35</cUF><xServ>STATUS</xServ>')
    expect(xml).not.toContain('enviNFe')
    expect(xml).not.toContain('<NFe>')
    expect(xml).not.toContain('tpAmb>1<')
  })
  test('cStat 107 somente marca disponível sem inferir autorização fiscal', () => {
    expect(interpretarRespostaStatusSefaz('<retConsStatServ><cStat>107</cStat><xMotivo>Servico em Operacao</xMotivo></retConsStatServ>')).toMatchObject({disponivel:true,codigo:107})
    expect(interpretarRespostaStatusSefaz('<retConsStatServ><cStat>108</cStat><xMotivo>Paralisado</xMotivo></retConsStatServ>').disponivel).toBe(false)
    expect(interpretarRespostaStatusSefaz('<soap:Fault>erro</soap:Fault>').disponivel).toBe(false)
    expect(interpretarRespostaStatusSefaz('erro inesperado').disponivel).toBe(false)
  })
  test('sem certificado válido, credenciais não podem ser usadas', () => {
    expect(() => lerA1DeVariaveis({})).toThrow()
    expect(() => lerA1DeVariaveis({SEFAZ_NFE_A1_PFX_BASE64: 'ZXJybw==', SEFAZ_NFE_A1_SENHA:'senha'})).toThrow()
    expect(() => lerA1DeVariaveis({SEFAZ_NFE_A1_PFX_BASE64: 'a'.repeat(200001), SEFAZ_NFE_A1_SENHA:'senha'})).toThrow()
  })
})
