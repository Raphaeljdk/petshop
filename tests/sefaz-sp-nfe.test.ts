import { X509Certificate } from 'node:crypto'
import { describe, test, expect } from 'bun:test'
import { ICP_BRASIL_V10, SEFAZ_SP, soapStatusNfeSp, interpretarRespostaStatusSefaz, lerA1DeVariaveis, classificarErroTransporteSefaz } from '../src/lib/sefaz-sp-nfe'

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

describe('diagnóstico seguro da conexão com SEFAZ-SP',()=>{
  test('distingue DNS, rede, timeout, reset e TLS sem revelar erro original',()=>{
    const entrada=[
      ['ENOTFOUND','dns'], ['EAI_AGAIN','dns'], ['ETIMEDOUT','tempo-esgotado'],
      ['ECONNRESET','conexao-encerrada'], ['EHOSTUNREACH','rede'],
      ['ERR_SSL_SSLV3_ALERT_BAD_CERTIFICATE','certificado-tls'],
    ] as const
    for (const [code,expected] of entrada){
      const result=classificarErroTransporteSefaz({code,message:'senha-secreta-nao-expor'})
      expect(result.categoria).toBe(expected)
      expect(result.message).not.toContain('senha-secreta')
    }
  })
})

describe('erros TLS detalhados sem revelar materiais do A1',()=>{
  test('distingue certificado rejeitado, CA, versao e codigo EPROTO',()=>{
    const casos=[
      [{code:'ERR_SSL_SSLV3_ALERT_BAD_CERTIFICATE',reason:'sslv3 alert bad certificate'},'certificado-rejeitado'],
      [{code:'UNABLE_TO_VERIFY_LEAF_SIGNATURE'},'cadeia-confianca'],
      [{code:'ERR_SSL_WRONG_VERSION_NUMBER',reason:'wrong version number'},'versao-tls'],
      [{code:'EPROTO',reason:'unsupported protocol'},'versao-tls'],
      [{code:'EPROTO',reason:'unknown reason'},'certificado-tls'],
    ] as const
    for(const [input,categoria] of casos)expect(classificarErroTransporteSefaz(input).categoria).toBe(categoria)
  })
  test('mensagem original e senha nunca retornam ao operador',()=>{
    const result=classificarErroTransporteSefaz({code:'ERR_SSL_SSLV3_ALERT_BAD_CERTIFICATE',message:'A1 senha: segredo'})
    expect(result.message).not.toContain('segredo')
  })
})

describe('raiz oficial usada pela conexão SEFAZ',()=>{
  test('material público é a CA ICP-Brasil v10 esperada, autoassinada e vigente',()=>{
    const ca=new X509Certificate(ICP_BRASIL_V10)
    expect(ca.fingerprint256.replaceAll(':','')).toBe('6E0BFF069A26994C15DE2C4888CC54AF84882E5495B7FBF66BE9CCFFEC7489F6')
    expect(ca.ca).toBe(true)
    expect(ca.subject).toBe(ca.issuer)
    expect(ca.verify(ca.publicKey)).toBe(true)
    expect(Date.parse(ca.validFrom)).toBeLessThan(Date.now())
    expect(Date.parse(ca.validTo)).toBeGreaterThan(Date.now())
  })
})
