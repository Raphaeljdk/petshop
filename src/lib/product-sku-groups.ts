/**
 * Uma referência visual por SKU, mantendo cada anúncio original (Mercado Livre,
 * Amazon, Zetta e loja). Não altera linhas, saldos, pedidos ou integrações.
 * Nunca some estoques de anúncios: compartilham ou podem disputar saldo físico.
 */
export type SkuProduct = {
  id:string; sku?:string|null; nome:string;
  zettaProCod?:number|null;mlItemId?:string|null;amazonAsin?:string|null;
  estoque?:number|null; ncm?:string|null;gtinFiscal?:string|null;
}
export function codigoCompartilhado(sku?:string|null):string|null {
  const s=(sku||'').trim().toUpperCase()
  if (s.length<5 || s.length>45 || /^MLB?\d+$/.test(s) || /^B0[A-Z0-9]{8}$/.test(s)) return null
  return s
}
export function agruparPorSku<T extends SkuProduct>(produtos:T[]):Array<{principal:T;anuncios:T[];skuAgrupado:string|null;estoquesDiferentes:boolean}> {
  const map=new Map<string,{skuAgrupado:string|null;anuncios:T[]}>()
  for(const row of produtos){
    const sku=codigoCompartilhado(row.sku)
    const key=sku?'sku:'+sku:'id:'+row.id
    const g=map.get(key)||{skuAgrupado:sku,anuncios:[]}
    g.anuncios.push(row);map.set(key,g)
  }
  const priority=(p:T)=> (p.zettaProCod!=null?100:0) + (p.ncm?15:0) + (p.gtinFiscal?8:0) +
    (p.mlItemId?2:0)+(p.amazonAsin?1:0)
  return Array.from(map.values()).map(g=>{
    const principal=[...g.anuncios].sort((a,b)=>priority(b)-priority(a)||a.nome.localeCompare(b.nome,'pt-BR'))[0]
    const estoques=new Set(g.anuncios.map(p=>Number(p.estoque??0)))
    return {principal,anuncios:g.anuncios,skuAgrupado:g.skuAgrupado,estoquesDiferentes:estoques.size>1}
  })
}
export const FISCAL_GROUP_FIELDS=[
  'ncm','gtinFiscal','cest','cfop','origem','cst','csosn','unidadeFiscal',
  'pisCst','cofinsCst','ipiCst','ibsCbsCst','ibsCbsClassTrib',
] as const
export type CampoFiscalAgrupavel = typeof FISCAL_GROUP_FIELDS[number]
export type ProdutoFiscalAgrupavel = SkuProduct & {[K in CampoFiscalAgrupavel]:string|null}
export type GrupoFiscal<T extends ProdutoFiscalAgrupavel> = T & {
  anunciosVinculados:number
  grupoSku:string|null
  camposDivergentes:CampoFiscalAgrupavel[]
  camposParciais:CampoFiscalAgrupavel[]
  anunciosOriginais:T[]
}
export function agruparFiscalPorSku<T extends ProdutoFiscalAgrupavel>(produtos:T[]):GrupoFiscal<T>[] {
  return agruparPorSku(produtos).map(grupo=>{
    const merged={...grupo.principal}
    const divergentes:CampoFiscalAgrupavel[]=[]
    const parciais:CampoFiscalAgrupavel[]=[]
    for(const campo of FISCAL_GROUP_FIELDS){
      const values=Array.from(new Set(grupo.anuncios.map(p=>p[campo]?.trim()||'').filter(Boolean)))
      if(values.length>1){merged[campo]=null as T[typeof campo];divergentes.push(campo)}
      else if(values.length===1){
        merged[campo]=values[0] as T[typeof campo]
        if(grupo.anuncios.some(p=>!p[campo]?.trim()))parciais.push(campo)
      }else merged[campo]=null as T[typeof campo]
    }
    return {...merged,anunciosVinculados:grupo.anuncios.length,grupoSku:grupo.skuAgrupado,
      camposDivergentes:divergentes,camposParciais:parciais,
      anunciosOriginais:grupo.anuncios}
  })
}
