import { describe,test,expect } from 'bun:test'
import { avaliarEmissaoFiscal, type FiscalSale } from '../src/lib/fiscal-central'
const venda=(canal:string):FiscalSale=>({canal,status:'concluida',total:129.90,
  marketplaceOrderId:canal==='mercadolivre'?'mercadolivre:200000123456789':null,
  notaFiscal:{status:'rascunho',chaveAcesso:null,emissorDocumentoId:null},
  marketplaceBuyerDocument:'12345678900',enderecoEntrega:'Rua',cepEntrega:'01001000',
  itens:[{quantidade:1,precoUnit:129.90,produto:{nome:'Coleira',ncm:'42010010',origem:'0',unidadeFiscal:'UN',csosn:'102'}}]})
const empresa={cnpj:'11222333000181',razaoSocial:'QA',inscricaoEstadual:'123456789',
  uf:'SP',codigoMunicipio:'3550308',logradouro:'Rua',numeroEndereco:'1',bairro:'Centro',
  cep:'01001000',regimeTributario:'1'}
const check=(canal:string,ml=false,universal=false,homologado=false,overrides?:Partial<FiscalSale>)=>
  avaliarEmissaoFiscal({venda:{...venda(canal),...overrides},empresa,
    meliHabilitado:ml,emissorUniversalConfigurado:universal,emissorUniversalHomologado:homologado})
describe('teste seguro de emissão central por canal',()=>{
  test('Mercado Livre somente habilita com permissão e sem documento anterior',()=>{
    expect(check('mercadolivre',true).habilitadoParaEmissao).toBe(true)
    expect(check('mercadolivre').habilitadoParaEmissao).toBe(false)
    expect(check('mercadolivre',true,false,false,{notaFiscal:{status:'autorizada',chaveAcesso:'1'.repeat(44)}}).habilitadoParaEmissao).toBe(false)
  })
  test('Site e Amazon não transmitem NF-e enquanto não existe payload MOC aprovado',()=>{
    for(const canal of ['site','amazon']){
      const s=check(canal,false,true,true)
      expect(s.modeloSugerido).toBe('55');expect(s.habilitadoParaEmissao).toBe(false)
      expect(s.checks.find(x=>x.id==='transmissao')?.ok).toBe(false)
      expect(s.transmitido).toBe(false)
    }
  })
  test('venda presencial exige fluxo distinto de NFC-e',()=>{
    const s=check('loja',false,true,true)
    expect(s.modeloSugerido).toBe('65');expect(s.habilitadoParaEmissao).toBe(false)
  })
  test('impede duplicação e informa faltas tributárias',()=>{
    expect(check('site',false,false,false,{notaFiscal:{status:'emissao_solicitada'}}).checks.find(x=>x.id==='duplicidade')?.ok).toBe(false)
    const s=check('amazon',false,true,true,{marketplaceBuyerDocument:null,cliente:null,
      itens:[{quantidade:1,precoUnit:100,produto:{nome:'Sem NCM'}}]})
    expect(s.checks.find(x=>x.id==='tributacao')?.ok).toBe(false)
    expect(s.checks.find(x=>x.id==='destinatario')?.ok).toBe(false)
  })
})
