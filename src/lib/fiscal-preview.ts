/** Documento de conferência interno. Não é XML NF-e no schema SEFAZ. */
export type PreviewCompany = Record<string, string | number | Date | null> | null
export type PreviewSale = {
  id: string; canal: string; status: string; total: number; createdAt: Date
  valorFrete: number | null; descontoCupom: number; subtotalProdutos: number | null
  marketplaceBuyerName: string | null; marketplaceBuyerDocument: string | null
  enderecoEntrega: string | null; cepEntrega: string | null
  cliente: { nome: string; cpfCnpj: string | null; endereco: string | null; cep: string | null } | null
  itens: Array<{ produtoId: string; quantidade: number; precoUnit: number; produto: {
    nome: string; sku: string | null; ncm: string | null; cest: string | null; cfop: string | null
    origem: string | null; cst: string | null; csosn: string | null; unidadeFiscal: string | null
  } }>
}
export class PreviewError extends Error {}
export function xmlText(value: unknown): string {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/gu, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
const tag = (name: string, value: unknown) => `<${name}>${xmlText(value)}</${name}>`
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100)
const money = (value: number) => (value / 100).toFixed(2)

export function gerarPreviaXml(venda: PreviewSale, empresa: PreviewCompany) {
  if (venda.status !== 'concluida') throw new PreviewError('A prévia exige uma venda concluída.')
  if (!['site', 'amazon', 'mercadolivre', 'mercado_livre'].includes(venda.canal))
    throw new PreviewError('Esta prévia é de NF-e para vendas online. Vendas presenciais exigem o módulo fiscal correspondente.')
  const validAmount = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1_000_000_000
  if (!venda.itens.length || venda.itens.length > 990 || !validAmount(venda.total) || venda.total <= 0 ||
      !validAmount(venda.valorFrete ?? 0) || !validAmount(venda.descontoCupom) ||
      venda.itens.some(i => !Number.isSafeInteger(i.quantidade) || i.quantidade <= 0 ||
        !validAmount(i.precoUnit) || !validAmount(i.quantidade * i.precoUnit)))
    throw new PreviewError('Venda com itens ou valores inválidos; revise antes de gerar a prévia.')
  const pendencias: string[] = [
    'Prévia interna: não validada pelo XSD oficial, não assinada e não transmitida.',
    'Número, chave de acesso e protocolo não foram gerados ou reservados.',
    'Impostos, regras da operação e leiaute vigente precisam de revisão fiscal; nenhum imposto foi calculado.',
    'Endereço do destinatário ainda exige estruturação; forma de pagamento fiscal não está disponível neste cadastro.',
  ]
  const required = ['razaoSocial','cnpj','inscricaoEstadual','regimeTributario','logradouro','numeroEndereco','bairro','cidade','uf','cep','codigoMunicipio']
  for (const field of required) if (!empresa?.[field]) pendencias.push('Emitente: falta ' + field + '.')
  const documento = venda.marketplaceBuyerDocument || venda.cliente?.cpfCnpj
  if (!documento) pendencias.push('Destinatário: falta CPF/CNPJ.')
  const subtotal = venda.itens.reduce((n, i) => n + cents(i.quantidade * i.precoUnit), 0)
  const frete = cents(venda.valorFrete ?? 0), desconto = cents(venda.descontoCupom), total = cents(venda.total)
  if (subtotal + frete - desconto !== total) pendencias.push('Total divergente: soma dos itens + frete - desconto difere do total registrado.')
  if (venda.subtotalProdutos !== null && cents(venda.subtotalProdutos) !== subtotal)
    pendencias.push('Subtotal cadastrado difere da soma dos itens.')
  const itens = venda.itens.map((i, index) => {
    const p = i.produto
    for (const field of ['ncm','cfop','origem','unidadeFiscal'] as const)
      if (!p[field]) pendencias.push(`Item ${index + 1}: falta ${field}.`)
    if (!p.cst && !p.csosn) pendencias.push(`Item ${index + 1}: falta CST/CSOSN.`)
    if (p.ncm && !/^\d{8}$/.test(p.ncm)) pendencias.push(`Item ${index + 1}: NCM deve conter 8 dígitos.`)
    return `<item numero="${index + 1}">` +
      tag('produtoId', i.produtoId) + tag('sku', p.sku) + tag('descricao', p.nome) +
      tag('quantidade', i.quantidade) + tag('precoUnitario', i.precoUnit.toFixed(4)) +
      tag('totalProduto', money(cents(i.quantidade * i.precoUnit))) +
      '<classificacaoCadastrada>' + Object.entries({ ncm:p.ncm,cest:p.cest,cfop:p.cfop,origem:p.origem,cst:p.cst,csosn:p.csosn,unidade:p.unidadeFiscal })
        .map(([k,v]) => tag(k,v)).join('') + '</classificacaoCadastrada></item>'
  }).join('')
  const emitente = required.concat('nomeFantasia','serieNfe').map(k => tag(k, empresa?.[k])).join('')
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<previaNFe versao="1" validadeFiscal="false" assinada="false" transmitida="false">' +
    tag('aviso','PRÉVIA PARA CONFERÊNCIA — SEM VALIDADE FISCAL. NÃO É UMA NF-e AUTORIZADA.') +
    '<venda>' + tag('id',venda.id) + tag('canal',venda.canal) + tag('dataVenda',venda.createdAt.toISOString()) + '</venda>' +
    '<emitente>' + emitente + '</emitente><destinatario>' +
    tag('nome',venda.marketplaceBuyerName || venda.cliente?.nome) + tag('documento',documento) +
    tag('enderecoCadastrado',venda.enderecoEntrega || venda.cliente?.endereco) + tag('cep',venda.cepEntrega || venda.cliente?.cep) +
    '</destinatario><itens>' + itens + '</itens><totais>' +
    tag('subtotalItens',money(subtotal)) + tag('frete',money(frete)) + tag('desconto',money(desconto)) +
    tag('totalCalculado',money(subtotal+frete-desconto)) + tag('totalRegistrado',money(total)) +
    '</totais><pendencias>' + pendencias.map(p => tag('pendencia',p)).join('') + '</pendencias></previaNFe>'
  return { xml, pendencias }
}
