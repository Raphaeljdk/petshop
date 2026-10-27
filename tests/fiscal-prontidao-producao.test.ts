import {test} from 'node:test'
import assert from 'node:assert/strict'
import {avaliarProntidaoNfeProducao,cnpjDigitosValidos} from '../src/lib/fiscal-prontidao-producao'

const empresa = {
  cnpj:'11.222.333/0001-81',razaoSocial:'Loja de Testes',inscricaoEstadual:'123456789',
  regimeTributario:'1',logradouro:'Rua A',numeroEndereco:'123',bairro:'Centro',
  cidade:'Sao Paulo',uf:'SP',cep:'01001000',codigoMunicipio:'3550308',
  serieNfe:1,ambiente:'producao',
}
test('confere dígitos verificadores do CNPJ e rejeita sequência',()=>{
  assert.equal(cnpjDigitosValidos(empresa.cnpj),true)
  assert.equal(cnpjDigitosValidos('11.222.333/0001-82'),false)
  assert.equal(cnpjDigitosValidos('00000000000000'),false)
})
test('selecionar produção nunca habilita emissão nem transmite',()=>{
  const status=avaliarProntidaoNfeProducao({
    empresa,certificadoRegistrado:true,produtosAtivos:3,produtosSemClassificacao:0,
  })
  assert.equal(status.ambienteSelecionado,'producao')
  assert.equal(status.emissaoRealHabilitada,false)
  assert.equal(status.requisitos.find(r=>r.id==='cadastro')?.ok,true)
  assert.equal(status.requisitos.find(r=>r.id==='a1-variaveis')?.ok,true)
  assert.equal(status.requisitos.find(r=>r.id==='assinatura')?.ok,false)
  assert.equal(status.requisitos.find(r=>r.id==='homologacao')?.ok,false)
  assert.equal(status.concluido,3)
})
test('não considera cadastro incompleto ou estoque não classificado como apto',()=>{
  const obj=avaliarProntidaoNfeProducao({
    empresa:{...empresa,cnpj:'11.222.333/0001-82',bairro:null},
    certificadoRegistrado:false,produtosAtivos:50,produtosSemClassificacao:17,
  })
  assert.equal(obj.requisitos.find(r=>r.id==='cadastro')?.ok,false)
  assert.equal(obj.requisitos.find(r=>r.id==='catalogo')?.ok,false)
  assert.equal(obj.requisitos.find(r=>r.id==='a1-variaveis')?.ok,false)
  assert.equal(obj.emissaoRealHabilitada,false)
})
test('diagnóstico é puro e não altera dados cadastrais',()=>{
  const before=structuredClone(empresa)
  avaliarProntidaoNfeProducao({empresa,certificadoRegistrado:true,produtosAtivos:1,produtosSemClassificacao:0})
  assert.deepEqual(empresa,before)
})

test('preparo da primeira NF-e de homologação não cria venda, não reserva número e não transmite',async()=>{
  const {prepararPrimeiraHomologacao,SKU_TESTE_INICIAL}=await import('../src/lib/nfe-homologacao-preparo')
  const doc={
    id:'p-1',sku:SKU_TESTE_INICIAL,nome:'Bola Jambo Pet',ativo:true,
    preco:52.99,ncm:'39269090',gtinFiscal:SKU_TESTE_INICIAL,cfop:'5102',csosn:'102',
    pisCst:'49',cofinsCst:'49',cest:null,origem:'0',unidadeFiscal:'UN',
  }
  const r=prepararPrimeiraHomologacao({
    produto:doc,
    emitente:{cnpj:'00000000000000',inscricaoEstadual:'123456',
      regimeTributario:'1',serieNfe:1,ambiente:'producao',uf:'SP',razaoSocial:'Exemplo'},
    documentos:[{serie:1,numero:1084,emissor:'mercado_livre',status:'autorizada'}],
    regrasAprovadas:0,certificadoConfigurado:true,
  })
  assert.equal(r.historico.maiorNumeroConhecidoNaSerie,1084)
  assert.equal(r.historico.numeroProximoConfirmado,false)
  assert.equal(r.tpAmbPlanejado,2)
  assert.equal(r.envioSefaz,false)
  assert.equal(r.alteracaoDeEstoque,false)
  assert.equal(r.criacaoDeVenda,false)
  assert.equal(r.liberadoParaTransmitir,false)
  assert.ok(r.pendencias.some(x=>x.includes('49')))
})
