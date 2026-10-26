import { agruparPorSku, type SkuProduct } from '@/lib/product-sku-groups'

/** Somente identidade documental do mesmo item físico, nunca impostos da venda.
 * Não inventar GTIN a partir de SKU nem substituir um valor já preenchido.
 */
export type ProdutoSkuFiscal = SkuProduct & {
  ncm:string|null;cest:string|null;gtinFiscal:string|null;
  cfop:string|null;csosn:string|null;pisCst:string|null;cofinsCst:string|null
}
export const CAMPOS_COMPARTILHAVEIS=['ncm','cest','gtinFiscal'] as const
export type CampoSku = typeof CAMPOS_COMPARTILHAVEIS[number]
export type PlanoSku = {
  sku:string
  anuncios:number
  elegivel:boolean
  razoes:string[]
  conflitosTributarios:string[]
  alvoIds:string[]
  atualizacoes:Array<{id:string;campos:Partial<Record<CampoSku,string>>}>
}
const valido=(s:string)=>/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(s) && (()=>{
  let soma=0
  for(let i=s.length-2,peso=3;i>=0;i--,peso=peso===3?1:3)soma+=Number(s[i])*peso
  return (10-soma%10)%10===Number(s[s.length-1])
})()
const norm=(v:string|null|undefined)=>(v||'').trim().toUpperCase()
const kit=(nome:string)=>/\b(?:KIT|COMBO|PACK|[2-9]\s?X)\b/i.test(nome)

export function planejarCompartilhamentoFiscal(produtos:ProdutoSkuFiscal[]):PlanoSku[]{
  return agruparPorSku(produtos).filter(g=>g.anuncios.length>1 && g.skuAgrupado).map(g=>{
    const sku=g.skuAgrupado!
    const razoes:string[]=[]
    if(!valido(sku))razoes.push('SKU não comprovado como GTIN válido; exige vínculo documental.')
    const codigosZetta=new Set(g.anuncios.map(p=>p.zettaProCod).filter((x):x is number=>x!=null))
    if(codigosZetta.size>1)razoes.push('Códigos de produtos Zetta diferentes no mesmo SKU.')
    const kits=new Set(g.anuncios.map(p=>kit(p.nome)))
    if(kits.size>1)razoes.push('Mistura de kit com produto unitário.')
    const referencias=Object.fromEntries(CAMPOS_COMPARTILHAVEIS.map(campo=>[
      campo,Array.from(new Set(g.anuncios.map(p=>norm(p[campo])).filter(Boolean))),
    ])) as Record<CampoSku,string[]>
    for(const campo of CAMPOS_COMPARTILHAVEIS)if(referencias[campo].length>1)
      razoes.push('Divergência no '+campo+'; preservar valores e revisar.')
    if(referencias.gtinFiscal.some(v=>!valido(v)||v!==sku))
      razoes.push('GTIN fiscal inválido ou diferente do SKU compartilhado.')
    if(referencias.ncm.some(v=>!/^\d{8}$/.test(v)))
      razoes.push('NCM informado não tem oito dígitos.')
    if(referencias.cest.some(v=>!/^\d{7}$/.test(v)))
      razoes.push('CEST informado não tem sete dígitos.')
    const divergencias=['cfop','csosn','pisCst','cofinsCst'] as const
    const conflitosTributarios=divergencias.filter(c=>
      new Set(g.anuncios.map(p=>norm(p[c])).filter(Boolean)).size>1
    )
    const atualizacoes=razoes.length?[]:g.anuncios.map(p=>{
      const campos:Partial<Record<CampoSku,string>>={}
      for(const campo of CAMPOS_COMPARTILHAVEIS)if((p[campo] == null || p[campo] === '') && referencias[campo].length===1)
        campos[campo]=referencias[campo][0]
      return {id:p.id,campos}
    }).filter(p=>Object.keys(p.campos).length>0)
    return {
      sku,anuncios:g.anuncios.length,elegivel:razoes.length===0,razoes,
      conflitosTributarios:[...conflitosTributarios],
      alvoIds:atualizacoes.map(p=>p.id),atualizacoes,
    }
  })
}
