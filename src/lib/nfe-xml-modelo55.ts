import { calcularDVChaveNfe } from './fiscal-chave'
import { xmlText } from './fiscal-preview'

/**
 * Gera SOMENTE rascunho de NF-e 55 no namespace nacional, em tpAmb=2.
 * O leiaute é estrutural; ainda NÃO há validação XSD 010f, assinatura, autorização
 * nem implementação integral dos grupos IBS/CBS 2026. Nunca transmitir este XML.
 * Cenário deliberadamente restrito: CRT 1, CSOSN 102/103/300/400 e PIS/COFINS NT.
 */
export class NfeRascunhoError extends Error {}

export type EnderecoNfe = {
  logradouro: string; numero: string; bairro: string; municipio: string
  codigoMunicipio: string; uf: string; cep: string
}
export type NfeEntrada = {
  numero: number; codigoNumerico: string; naturezaOperacao: string
  destinatario: { nome: string; documento: string; endereco: EnderecoNfe }
  pagamento: '01' | '17' | '18'
  modalidadeFrete: '0' | '1' | '2' | '9'
  itens: Array<{ produtoId: string; pisCst: string; cofinsCst: string }>
}
export type NfeEmpresa = {
  cnpj: string | null; razaoSocial: string | null; nomeFantasia: string | null
  inscricaoEstadual: string | null; regimeTributario: string | null
  logradouro: string | null; numeroEndereco: string | null; bairro: string | null
  cidade: string | null; codigoMunicipio: string | null; uf: string | null; cep: string | null
  serieNfe: number
}
export type NfeVenda = {
  id: string; status: string; canal: string; total: number; valorFrete: number | null
  descontoCupom: number; subtotalProdutos: number | null
  itens: Array<{ produtoId: string; quantidade: number; precoUnit: number
    produto: { nome: string; sku: string | null; ncm: string | null; cest: string | null
      cfop: string | null; origem: string | null; csosn: string | null; unidadeFiscal: string | null }
  }>
}

const NS = 'http://www.portalfiscal.inf.br/nfe'
const numerico = (v: string | number | null | undefined) => String(v ?? '').replace(/\D/g, '')
const campo = (tag: string, value: string | number) => '<' + tag + '>' + xmlText(value) + '</' + tag + '>'
const cents = (n: number) => Math.round((n + Number.EPSILON) * 100)
const moeda = (centavos: number) => (centavos / 100).toFixed(2)
const necessario = (ok: unknown, descricao: string) => {
  if (!ok) throw new NfeRascunhoError(descricao)
}
const enderecoXml = (e: EnderecoNfe) =>
  campo('xLgr', e.logradouro.trim()) + campo('nro', e.numero.trim()) +
  campo('xBairro', e.bairro.trim()) + campo('cMun', e.codigoMunicipio) +
  campo('xMun', e.municipio.trim()) + campo('UF', e.uf.toUpperCase()) +
  campo('CEP', numerico(e.cep)) + campo('cPais', '1058') + campo('xPais', 'BRASIL')

export function gerarRascunhoNfe55(
  venda: NfeVenda, empresa: NfeEmpresa, entrada: NfeEntrada,
  dataEmissao = new Date(),
) {
  necessario(venda.status === 'concluida', 'A venda deve estar concluída.')
  necessario(['site','amazon'].includes(venda.canal), 'Somente vendas do site ou Amazon. Mercado Livre utiliza seu Faturador e não pode duplicar a nota.')
  necessario(empresa.regimeTributario === '1', 'Este gerador inicial cobre apenas CRT 1 (Simples Nacional). Outros regimes ainda precisam de implementação.')
  necessario(numerico(empresa.cnpj).length === 14 && numerico(empresa.inscricaoEstadual).length >= 2, 'CNPJ e IE do emitente são obrigatórios.')
  necessario(empresa.razaoSocial?.trim() && empresa.logradouro?.trim() && empresa.numeroEndereco?.trim()
    && empresa.bairro?.trim() && empresa.cidade?.trim() && empresa.uf === 'SP'
    && numerico(empresa.codigoMunicipio).length === 7 && numerico(empresa.cep).length === 8,
    'Cadastro fiscal do emitente SP incompleto.')
  const end = entrada.destinatario.endereco
  necessario(entrada.destinatario.nome.trim().length >= 2
    && [11,14].includes(numerico(entrada.destinatario.documento).length),
    'Informe nome e CPF/CNPJ do destinatário.')
  necessario(end.logradouro.trim() && end.numero.trim() && end.bairro.trim()
    && end.municipio.trim() && /^\d{7}$/.test(numerico(end.codigoMunicipio))
    && /^[A-Z]{2}$/.test(end.uf.toUpperCase()) && numerico(end.cep).length === 8,
    'Endereço estruturado do destinatário está incompleto.')
  necessario(Number.isSafeInteger(entrada.numero) && entrada.numero >= 1 && entrada.numero <= 999999999
    && Number.isSafeInteger(empresa.serieNfe) && empresa.serieNfe >= 1 && empresa.serieNfe <= 999
    && /^\d{8}$/.test(entrada.codigoNumerico),
    'Número, série ou código numérico de oito dígitos inválido. Consulte a numeração com o contador.')
  necessario(entrada.naturezaOperacao.trim().length >= 3 && entrada.naturezaOperacao.length <= 60,
    'Informe a natureza da operação validada pelo contador.')
  necessario(['01','17','18'].includes(entrada.pagamento)
    && ['0','1','2','9'].includes(entrada.modalidadeFrete),
    'Forma de pagamento ou modalidade de frete não suportada neste primeiro gerador.')
  necessario(venda.itens.length > 0 && venda.itens.length <= 990
    && venda.itens.length === entrada.itens.length, 'Itens fiscais e itens da venda não conferem.')
  necessario(Number.isFinite(venda.total) && venda.total > 0
    && Number.isFinite(venda.valorFrete ?? 0) && (venda.valorFrete ?? 0) >= 0
    && Number.isFinite(venda.descontoCupom) && venda.descontoCupom >= 0,
    'Valores da venda inválidos.')
  const subtotal = venda.itens.reduce((total, item) => {
    necessario(Number.isSafeInteger(item.quantidade) && item.quantidade > 0
      && Number.isFinite(item.precoUnit) && item.precoUnit >= 0, 'Quantidade ou valor unitário inválido.')
    return total + cents(item.precoUnit * item.quantidade)
  }, 0)
  const frete = cents(venda.valorFrete ?? 0)
  const desconto = cents(venda.descontoCupom)
  necessario(subtotal + frete - desconto === cents(venda.total)
    && (venda.subtotalProdutos == null || cents(venda.subtotalProdutos) === subtotal),
    'Total divergente. Revise produtos, frete, desconto e total da venda.')
  const doc = numerico(entrada.destinatario.documento)
  const emissao = Number.isNaN(dataEmissao.getTime()) ? null : dataEmissao.toISOString().replace('Z', '+00:00')
  necessario(emissao, 'Data de emissão inválida.')
  const aamm = emissao.slice(2,4) + emissao.slice(5,7)
  const base43 = '35' + aamm + numerico(empresa.cnpj) + '55' +
    String(empresa.serieNfe).padStart(3, '0') + String(entrada.numero).padStart(9, '0') +
    '1' + entrada.codigoNumerico
  const dv = calcularDVChaveNfe(base43)
  const chave = base43 + dv
  const idDest = end.uf.toUpperCase() === 'SP' ? '1' : '2'
  const ide = campo('cUF','35') + campo('cNF', entrada.codigoNumerico) +
    campo('natOp', entrada.naturezaOperacao) + campo('mod','55') +
    campo('serie',empresa.serieNfe) + campo('nNF',entrada.numero) +
    campo('dhEmi',emissao as string) + campo('tpNF','1') + campo('idDest',idDest) +
    campo('cMunFG',numerico(empresa.codigoMunicipio)) + campo('tpImp','1') +
    campo('tpEmis','1') + campo('cDV',dv) + campo('tpAmb','2') +
    campo('finNFe','1') + campo('indFinal','1') + campo('indPres','2') +
    campo('procEmi','0') + campo('verProc','MatilhaPrado-rascunho-0.1')
  const emitEndereco: EnderecoNfe = {
    logradouro: empresa.logradouro as string, numero: empresa.numeroEndereco as string,
    bairro: empresa.bairro as string, municipio: empresa.cidade as string,
    codigoMunicipio: numerico(empresa.codigoMunicipio), uf: 'SP',
    cep: numerico(empresa.cep),
  }
  const emit = campo('CNPJ',numerico(empresa.cnpj)) + campo('xNome',empresa.razaoSocial as string) +
    (empresa.nomeFantasia?.trim() ? campo('xFant',empresa.nomeFantasia.trim()) : '') +
    '<enderEmit>' + enderecoXml(emitEndereco) + '</enderEmit>' +
    campo('IE',numerico(empresa.inscricaoEstadual)) + campo('CRT','1')
  // Em homologação, a SEFAZ exige o texto padronizado no xNome do destinatário.
  const dest = campo(doc.length === 11 ? 'CPF' : 'CNPJ', doc) +
    campo('xNome','NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL') +
    '<enderDest>' + enderecoXml(end) + '</enderDest>' + campo('indIEDest','9')
  const detalhes = venda.itens.map((item, index) => {
    const p = item.produto
    const fiscal = entrada.itens[index]
    necessario(fiscal.produtoId === item.produtoId,
      'A lista de itens fiscais não corresponde à venda. Atualize o formulário.')
    necessario(/^\d{8}$/.test(numerico(p.ncm)) && /^\d{4}$/.test(numerico(p.cfop))
      && /^[0-8]$/.test(p.origem || '') && /^(102|103|300|400)$/.test(p.csosn || '')
      && !!p.unidadeFiscal?.trim(), 'Item ' + (index + 1) + ': classificação NCM, CFOP, origem, unidade e CSOSN inválida ou incompleta.')
    necessario(['04','05','06','07','08','09'].includes(fiscal.pisCst)
      && ['04','05','06','07','08','09'].includes(fiscal.cofinsCst),
      'Item ' + (index + 1) + ': informe CST PIS/COFINS não tributável, validado pelo contador.')
    // Não presume alíquotas, IBS/CBS ou ICMS: cenários tributados exigem módulos específicos.
    const unit = p.unidadeFiscal as string
    const vProd = cents(item.precoUnit * item.quantidade)
    const prod = campo('cProd',(p.sku || item.produtoId).slice(0,60)) +
      campo('cEAN','SEM GTIN') + campo('xProd',p.nome) + campo('NCM',numerico(p.ncm)) +
      (p.cest ? campo('CEST',numerico(p.cest)) : '') +
      campo('CFOP',numerico(p.cfop)) + campo('uCom',unit) +
      campo('qCom',item.quantidade.toFixed(4)) + campo('vUnCom',item.precoUnit.toFixed(10)) +
      campo('vProd',moeda(vProd)) + campo('cEANTrib','SEM GTIN') +
      campo('uTrib',unit) + campo('qTrib',item.quantidade.toFixed(4)) +
      campo('vUnTrib',item.precoUnit.toFixed(10)) + campo('indTot','1')
    const imposto = '<ICMS><ICMSSN102>' + campo('orig',p.origem as string) +
      campo('CSOSN',p.csosn as string) + '</ICMSSN102></ICMS>' +
      '<PIS><PISNT>' + campo('CST',fiscal.pisCst) + '</PISNT></PIS>' +
      '<COFINS><COFINSNT>' + campo('CST',fiscal.cofinsCst) + '</COFINSNT></COFINS>'
    return '<det nItem="' + (index+1) + '"><prod>' + prod +
      '</prod><imposto>' + imposto + '</imposto></det>'
  }).join('')
  const totais = '<ICMSTot>' +
    ['vBC','vICMS','vICMSDeson','vFCP','vBCST','vST','vFCPST','vFCPSTRet']
      .map(k => campo(k,'0.00')).join('') +
    campo('vProd',moeda(subtotal)) + campo('vFrete',moeda(frete)) +
    campo('vSeg','0.00') + campo('vDesc',moeda(desconto)) +
    ['vII','vIPI','vIPIDevol','vPIS','vCOFINS','vOutro']
      .map(k => campo(k,'0.00')).join('') +
    campo('vNF',moeda(cents(venda.total))) + '</ICMSTot>'
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!-- RASCUNHO EM HOMOLOGACAO: NAO ASSINADO, NAO VALIDADO EM XSD, NAO TRANSMITIDO; CHAVE E NUMERO NAO RESERVADOS -->\n' +
    '<NFe xmlns="' + NS + '"><infNFe versao="4.00" Id="NFe' + chave + '">' +
    '<ide>' + ide + '</ide><emit>' + emit + '</emit><dest>' + dest + '</dest>' +
    detalhes + '<total>' + totais + '</total>' +
    '<transp>' + campo('modFrete',entrada.modalidadeFrete) + '</transp>' +
    '<pag><detPag>' + campo('indPag','0') + campo('tPag',entrada.pagamento) +
    campo('vPag',moeda(cents(venda.total))) + '</detPag></pag>' +
    '</infNFe></NFe>'
  return { xml, chaveApenasEstrutural: chave, ambiente: 'homologacao' as const,
    aviso: 'Rascunho NF-e 55 (tpAmb=2). Numeração NÃO reservada. Assinatura, XSD 010f, IBS/CBS quando aplicável e autorização SEFAZ pendentes. NÃO transmitir.' }
}
