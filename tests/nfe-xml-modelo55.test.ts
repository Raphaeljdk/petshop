import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gerarRascunhoNfe55, NfeRascunhoError, type NfeEmpresa, type NfeEntrada, type NfeVenda } from '../src/lib/nfe-xml-modelo55'
import { calcularDVChaveNfe } from '../src/lib/fiscal-chave'

function dados() {
  const empresa: NfeEmpresa = {
    cnpj:'12345678000195',razaoSocial:'Loja Teste',nomeFantasia:null,
    inscricaoEstadual:'123456789',regimeTributario:'1',logradouro:'Rua A',
    numeroEndereco:'10',bairro:'Centro',cidade:'Sao Paulo',codigoMunicipio:'3550308',
    uf:'SP',cep:'01001000',serieNfe:1,
  }
  const venda: NfeVenda = {
    id:'venda-unitaria',status:'concluida',canal:'site',total:32,subtotalProdutos:30,
    valorFrete:5,descontoCupom:3,
    itens:[{produtoId:'prod-1',quantidade:2,precoUnit:10,produto:{
      nome:'Osso & pet <brinquedo>',sku:'OSSO',ncm:'95030099',cest:null,
      cfop:'5102',origem:'0',csosn:'102',unidadeFiscal:'UN',
    }},{produtoId:'prod-2',quantidade:1,precoUnit:10,produto:{
      nome:'Teste pet',sku:'PET',ncm:'95030099',cest:null,
      cfop:'5102',origem:'0',csosn:'102',unidadeFiscal:'UN',
    }}],
  }
  const entrada:NfeEntrada = {
    numero:123,codigoNumerico:'12345678',naturezaOperacao:'Venda interna',
    destinatario:{
      nome:'Cliente real',documento:'12345678909',indicadorIE:'9',
      endereco:{logradouro:'Rua B',numero:'123',bairro:'Bela Vista',municipio:'Sao Paulo',
        codigoMunicipio:'3550308',uf:'SP',cep:'01310000'},
    },
    consumidorFinal:'1',pagamento:'17',modalidadeFrete:'0',
    itens:[{produtoId:'prod-1',gtin:'SEM GTIN',pisCst:'07',cofinsCst:'07'},
      {produtoId:'prod-2',gtin:'SEM GTIN',pisCst:'07',cofinsCst:'07'}],
  }
  return {empresa,venda,entrada}
}
test('gera estrutura nacional NF-e 55 em homologação sem afirmar autorização',()=>{
  const {empresa,venda,entrada}=dados()
  const resultado=gerarRascunhoNfe55(venda,empresa,entrada,new Date('2026-10-21T19:00:00Z'))
  assert.match(resultado.xml,/<NFe xmlns="http:\/\/www.portalfiscal.inf.br\/nfe"><infNFe versao="4.00" Id="NFe35/)
  assert.match(resultado.xml,/<tpAmb>2<\/tpAmb>/)
  assert.match(resultado.xml,/<xNome>NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL<\/xNome>/)
  assert.match(resultado.xml,/<xProd>Osso &amp; pet &lt;brinquedo&gt;<\/xProd>/)
  assert.match(resultado.xml,/<ICMS><ICMSSN102><orig>0<\/orig><CSOSN>102<\/CSOSN><\/ICMSSN102><\/ICMS>/)
  assert.match(resultado.xml,/<pag><detPag>.*<tPag>17<\/tPag><vPag>32.00<\/vPag><\/detPag><\/pag>/)
  assert.match(resultado.xml,/<vFrete>5.00<\/vFrete>/)
  assert.match(resultado.xml,/<vDesc>3.00<\/vDesc>/)
  assert.ok(!/<Signature\b|<protNFe\b|<nfeProc\b/.test(resultado.xml))
  const chave=resultado.chaveApenasEstrutural
  assert.equal(chave.length,44)
  assert.equal(calcularDVChaveNfe(chave.slice(0,43)),chave[43])
})
test('rateia frete e desconto com exatidão de centavos',()=>{
  const {empresa,venda,entrada}=dados()
  const result=gerarRascunhoNfe55(venda,empresa,entrada)
  const fretes=Array.from(result.xml.matchAll(/<vFrete>([\d.]+)<\/vFrete>/g),m=>Number(m[1]))
  const descontos=Array.from(result.xml.matchAll(/<vDesc>([\d.]+)<\/vDesc>/g),m=>Number(m[1]))
  // Incluem 2 itens e 1 total.
  assert.equal(fretes.length,3); assert.equal(descontos.length,3)
  assert.equal(Math.round((fretes[0]+fretes[1])*100),500)
  assert.equal(Math.round((descontos[0]+descontos[1])*100),300)
})
test('bloqueia tributos incompletos sem assumir alíquotas',()=>{
  const {empresa,venda,entrada}=dados()
  entrada.itens[0].pisCst=''
  assert.throws(()=>gerarRascunhoNfe55(venda,empresa,entrada),NfeRascunhoError)
})
test('bloqueia vendas com notas em canais delegados e operações interestaduais não suportadas',()=>{
  const {empresa,venda,entrada}=dados()
  venda.canal='mercadolivre'
  assert.throws(()=>gerarRascunhoNfe55(venda,empresa,entrada),/Mercado Livre/)
  venda.canal='site';entrada.destinatario.endereco.uf='RJ'
  assert.throws(()=>gerarRascunhoNfe55(venda,empresa,entrada),/vendas internas em SP/)
})
test('bloqueia divergência financeira, SKU alterado e GTIN não confirmado',()=>{
  const {empresa,venda,entrada}=dados()
  venda.total=32.01
  assert.throws(()=>gerarRascunhoNfe55(venda,empresa,entrada),/Total divergente/)
  venda.total=32;entrada.itens[0].produtoId='outro'
  assert.throws(()=>gerarRascunhoNfe55(venda,empresa,entrada),/lista de itens/)
  entrada.itens[0].produtoId='prod-1';entrada.itens[0].gtin=''
  assert.throws(()=>gerarRascunhoNfe55(venda,empresa,entrada),/GTIN/)
})
test('não modifica vendas nem configurações e não gera protocolo SEFAZ',()=>{
  const {empresa,venda,entrada}=dados()
  const before=structuredClone({empresa,venda,entrada})
  const {xml}=gerarRascunhoNfe55(venda,empresa,entrada)
  assert.deepEqual({empresa,venda,entrada},before)
  assert.doesNotMatch(xml,/<protNFe|<nProt|<Signature/)
})
