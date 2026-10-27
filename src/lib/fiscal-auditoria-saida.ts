/**
 * Auditoria preventiva de códigos já cadastrados (não é parecer fiscal).
 * O cadastro de produto NÃO contém a UF/IE do destinatário de cada venda:
 * CFOP/CSOSN/PIS/COFINS finais só podem ser confirmados pela operação real.
 */
export type ProdutoAuditoriaFiscal = {
  id:string; nome:string; sku:string|null; ncm:string|null; cfop:string|null
  csosn:string|null; pisCst:string|null; cofinsCst:string|null
}
export type OcorrenciaFiscal = {
  codigo:'CFOP_ENTRADA_EM_VENDA'|'CFOP_5109_ESPECIAL'|'PIS_49_NAO_SUPORTADO_XML'|'COFINS_49_NAO_SUPORTADO_XML'
  severidade:'bloqueio'|'revisao'|'tecnico'
  detalhe:string
}
const normalizar=(v:string|null|undefined)=>(v||'').trim()

export function auditarProdutoParaNfeSaida(p:ProdutoAuditoriaFiscal):OcorrenciaFiscal[]{
  const cfop=normalizar(p.cfop)
  const pis=normalizar(p.pisCst)
  const cofins=normalizar(p.cofinsCst)
  const ocorrencias:OcorrenciaFiscal[]=[]
  if(/^[123]\d{3}$/.test(cfop))
    ocorrencias.push({
      codigo:'CFOP_ENTRADA_EM_VENDA',severidade:'bloqueio',
      detalhe:'CFOP '+cfop+' identifica entrada/aquisição; não pode ser reutilizado como CFOP da venda. Confirme a operação antes de corrigir.',
    })
  if(cfop==='5109'||cfop==='6109')
    ocorrencias.push({
      codigo:'CFOP_5109_ESPECIAL',severidade:'revisao',
      detalhe:'CFOP '+cfop+' corresponde a venda de produção própria destinada à Zona Franca de Manaus/Área de Livre Comércio. Confirmar origem da mercadoria e destino; em revenda de mercadoria de terceiros pode não se aplicar.',
    })
  if(pis==='49')
    ocorrencias.push({
      codigo:'PIS_49_NAO_SUPORTADO_XML',severidade:'tecnico',
      detalhe:'PIS CST 49 existe na tabela oficial, mas o rascunho NF-e do ERP só suporta CST 04–09. O tratamento de 49 exige implementação do grupo PISOutr e validação fiscal.',
    })
  if(cofins==='49')
    ocorrencias.push({
      codigo:'COFINS_49_NAO_SUPORTADO_XML',severidade:'tecnico',
      detalhe:'COFINS CST 49 existe na tabela oficial, mas o rascunho NF-e do ERP só suporta CST 04–09. O tratamento de 49 exige implementação do grupo COFINSOutr e validação fiscal.',
    })
  return ocorrencias
}

export function auditarCatalogoSaida(produtos:ProdutoAuditoriaFiscal[]){
  const cadastrados=produtos.filter(p=>[p.cfop,p.csosn,p.pisCst,p.cofinsCst].some(x=>!!normalizar(x)))
  const alertas=cadastrados.flatMap(p=>auditarProdutoParaNfeSaida(p).map(o=>({
    produtoId:p.id,sku:p.sku,nome:p.nome,...o,
  })))
  const bySku=new Map<string,Set<string>>()
  for(const p of cadastrados){
    if(!p.sku||!normalizar(p.cfop))continue
    const atual=bySku.get(p.sku)||new Set<string>();atual.add(normalizar(p.cfop))
    bySku.set(p.sku,atual)
  }
  const divergenciasCfop=[...bySku].filter(([,set])=>set.size>1)
    .map(([sku,set])=>({sku,codigos:[...set].sort()}))
  const camposBasicos=cadastrados.filter(p=>[p.ncm,p.cfop,p.csosn,p.pisCst,p.cofinsCst].every(x=>!!normalizar(x)))
  return {
    totalAnuncios:produtos.length,
    comAlgumCodigoSaida:cadastrados.length,
    camposBasicosInformados:camposBasicos.length,
    porCfop:Object.entries(cadastrados.reduce<Record<string,number>>((a,p)=>{
      const c=normalizar(p.cfop)||'(vazio)';a[c]=(a[c]||0)+1;return a
    },{})).map(([codigo,quantidade])=>({codigo,quantidade})).sort((a,b)=>b.quantidade-a.quantidade),
    entradaEmVenda:alertas.filter(x=>x.codigo==='CFOP_ENTRADA_EM_VENDA').length,
    especiaisRevisar:alertas.filter(x=>x.codigo==='CFOP_5109_ESPECIAL').length,
    comPis49:cadastrados.filter(x=>normalizar(x.pisCst)==='49').length,
    comCofins49:cadastrados.filter(x=>normalizar(x.cofinsCst)==='49').length,
    divergenciasCfop,
    alertas,
  }
}
