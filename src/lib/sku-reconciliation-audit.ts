/** Auditoria somente leitura: SKU/GTIN não prova que dois anúncios sejam o mesmo item físico. */
export type AuditProduct = {
  id: string
  sku: string | null
  nome: string
  estoque: number
  estoqueHub: number
  ativo: boolean
  mlItemId: string | null
  amazonAsin: string | null
}
export type AuditSkuGroup = {
  sku: string
  items: AuditProduct[]
  divergentStock: boolean
  divergentHub: boolean
  divergentNames: boolean
  divergentPublication: boolean
  linkedMl: number
  linkedAmazon: number
  status: 'physical_count' | 'identity_review' | 'identical_mirrors'
}
const uniq = <T>(values:T[]) => new Set(values).size
export function buildSkuAudit(products:AuditProduct[]) {
  const groups = new Map<string,AuditProduct[]>()
  for(const product of products){
    const sku=product.sku?.trim()
    if(!sku)continue
    const items=groups.get(sku)||[]
    items.push(product)
    groups.set(sku,items)
  }
  const duplicated=[...groups.entries()].filter(([,rows])=>rows.length>1)
    .map(([sku,items]):AuditSkuGroup=>{
      const divergentStock=uniq(items.map(p=>p.estoque))>1
      const divergentHub=items.some(p=>p.estoque!==p.estoqueHub) ||
        uniq(items.map(p=>p.estoqueHub))>1
      const divergentNames=uniq(items.map(p=>p.nome.trim().toLowerCase()))>1
      const divergentPublication=uniq(items.map(p=>p.ativo))>1
      const linkedMl=items.filter(p=>p.mlItemId).length
      const linkedAmazon=items.filter(p=>p.amazonAsin).length
      const status:AuditSkuGroup['status'] =
        divergentStock||divergentHub||divergentPublication?'physical_count'
        :divergentNames?'identity_review':'identical_mirrors'
      return {sku,items,divergentStock,divergentHub,divergentNames,
        divergentPublication,linkedMl,linkedAmazon,status}
    })
    .sort((a,b)=>{
      const score=(g:AuditSkuGroup)=>g.status==='physical_count'?2:g.status==='identity_review'?1:0
      return score(b)-score(a)||b.items.length-a.items.length||a.sku.localeCompare(b.sku)
    })
  const asinGroups=new Map<string,AuditProduct[]>()
  for(const p of products){
    if(!p.amazonAsin)continue
    const items=asinGroups.get(p.amazonAsin)||[]
    items.push(p)
    asinGroups.set(p.amazonAsin,items)
  }
  const duplicateAsins=[...asinGroups.entries()]
    .filter(([,rows])=>rows.length>1)
    .map(([asin,items])=>({
      asin,ids:items.map(p=>p.id),skus:[...new Set(items.map(p=>p.sku))],
      inconsistentStock:uniq(items.map(p=>p.estoque))>1,
    }))
  return {
    groups:duplicated,
    duplicateAsins,
    summary:{
      products:products.length,
      duplicateSkus:duplicated.length,
      duplicateRows:duplicated.reduce((n,g)=>n+g.items.length,0),
      differentStock:duplicated.filter(g=>g.divergentStock).length,
      differentNames:duplicated.filter(g=>g.divergentNames).length,
      hubStockDivergences:products.filter(p=>p.estoque!==p.estoqueHub).length,
      conflictingPublication:duplicated.filter(g=>g.divergentPublication).length,
      needsPhysicalCount:duplicated.filter(g=>g.status==='physical_count').length,
      identityReview:duplicated.filter(g=>g.status==='identity_review').length,
      identicalMirrors:duplicated.filter(g=>g.status==='identical_mirrors').length,
      duplicateAsins:duplicateAsins.length,
    },
  }
}
