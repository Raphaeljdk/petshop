/** Importação fiscal de CSV Zetta: somente identificação documental, sem impostos da saída. */
export type ProdutoParaImportar = { id:string; nome:string; sku:string|null; zettaProCod:number|null; ncm:string|null; cest:string|null; gtinFiscal:string|null; origem:string|null }
export type LinhaFiscalZetta = {linha:number;codigo:string;zettaProCod:string;gtin:string;descricao:string;ncm:string;cest:string;origem:string;unidade:string;camposDeVendaInformados:boolean}
export type CandidatoImportacao = {
 linha:number;status:'apto'|'sem_vinculo'|'conflito'|'revisar'|'sem_dados'|'duplicado';motivo:string;sku:string;descricao:string;produtoIds:string[]
 alteracoes:Array<{produtoId:string;campos:Partial<Pick<ProdutoParaImportar,'ncm'|'cest'|'gtinFiscal'|'origem'>>}>
}
const texto=(s:unknown)=>String(s??'').trim()
const digitos=(s:string)=>s.replace(/\D/g,'')
const col=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const headers={
 codigo:['codigo','codigoproduto','codproduto','codigointerno','sku','referencia','codpro'],
 zettaProCod:['procod','zettaprocod','idzetta','idprodutozetta','codigozetta','codigosiggma'],
 gtin:['gtin','ean','ean13','codigobarras','codigodebarras','codbarra','codigoebarcode'],
 descricao:['descricao','descricaoproduto','nome','produto'],
 ncm:['ncm','ncmsh','ncmproduto','codigoncm'],
 cest:['cest','codigocest'],
 origem:['origem','origemmercadoria','origemproduto'],
 unidade:['unidade','unidadefiscal','un'],
} as const
export function gtinValido(codigo:string):boolean{
 if(!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(codigo))return false
 let soma=0
 for(let i=codigo.length-2,peso=3;i>=0;i--,peso=peso===3?1:3)soma+=Number(codigo[i])*peso
 return (10-soma%10)%10===Number(codigo[codigo.length-1])
}
function delimitador(line:string){
 const sep=[';',',','\t'];let quote=false,counts=[0,0,0]
 for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quote&&line[i+1]==='"')i++;else quote=!quote}
 else if(!quote){const idx=sep.indexOf(c);if(idx>=0)counts[idx]++}}
 return sep[counts.indexOf(Math.max(...counts))]
}
export function lerCsvFiscalZetta(csv:string):LinhaFiscalZetta[]{
 if(!csv.trim())throw Error('Arquivo CSV vazio.')
 if(csv.length>600_000)throw Error('Arquivo maior que 600 KB. Divida em lotes.')
 csv=csv.replace(/^\uFEFF/,'')
 const separator=delimitador(csv.split(/\r?\n/,1)[0])
 const records:string[][]=[];let parts:string[]=[],field='',quote=false
 for(let i=0;i<csv.length;i++){
  const c=csv[i]
  if(c==='"'){if(quote&&csv[i+1]==='"'){field+='"';i++}else quote=!quote}
  else if(c===separator&&!quote){parts.push(field);field=''}
  else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&csv[i+1]==='\n')i++;parts.push(field);field='';if(parts.some(x=>x.trim()))records.push(parts);parts=[]}
  else field+=c
 }
 if(quote)throw Error('CSV com aspas abertas.')
 parts.push(field);if(parts.some(x=>x.trim()))records.push(parts)
 if(records.length<2)throw Error('CSV sem produtos.')
 if(records.length>2501)throw Error('Limite de 2.500 linhas por arquivo.')
 const names=records[0].map(col)
 const idx=(key:keyof typeof headers)=>names.findIndex(s=>(headers[key] as readonly string[]).includes(s))
 if(idx('ncm')<0||(idx('gtin')<0&&idx('zettaProCod')<0))throw Error('CSV exige NCM e GTIN/EAN ou pro_cod Zetta.')
 const get=(r:string[],key:keyof typeof headers)=>idx(key)>=0?texto(r[idx(key)]):''
 return records.slice(1).map((r,i)=>({
  linha:i+2,codigo:get(r,'codigo'),zettaProCod:digitos(get(r,'zettaProCod')),
  gtin:digitos(get(r,'gtin')),descricao:get(r,'descricao'),ncm:digitos(get(r,'ncm')),
  cest:digitos(get(r,'cest')),origem:get(r,'origem'),unidade:get(r,'unidade'),
  camposDeVendaInformados:names.some(s=>['cfop','csosn','cstpis','cstcofins','icms','pis','cofins','aliquota','aliquotaicms'].includes(s)),
 }))
}
const eKit=(s:string)=>/\b(?:kit|combo|[2-9]\s?x|pack\s?\d+)\b/i.test(s)
const igualOuVazio=(atual:string|null,novo:string)=>!atual?.trim()||!novo||atual===novo
export function simularImportacaoFiscalZetta(linhas:LinhaFiscalZetta[],catalogo:ProdutoParaImportar[]):CandidatoImportacao[]{
 const byId=new Map<number,ProdutoParaImportar>(),byGtin=new Map<string,ProdutoParaImportar[]>()
 for(const p of catalogo){
  if(p.zettaProCod!=null)byId.set(p.zettaProCod,p)
  for(const codigo of new Set([p.sku,p.gtinFiscal].filter(Boolean))){
   if(codigo&&gtinValido(codigo)){const matches=byGtin.get(codigo)||[];matches.push(p);byGtin.set(codigo,matches)}
  }
 }
 const vistos=new Set<string>()
 return linhas.map(r=>{
  const base={linha:r.linha,sku:r.gtin||r.codigo,descricao:r.descricao,produtoIds:[] as string[],alteracoes:[] as CandidatoImportacao['alteracoes']}
  const ret=(status:CandidatoImportacao['status'],motivo:string):CandidatoImportacao=>({...base,status,motivo})
  if(!r.ncm&&!r.cest&&!r.gtin&&!r.origem)return ret('sem_dados','Sem classificação fiscal preenchida no Zetta.')
  if((r.ncm&&!/^\d{8}$/.test(r.ncm))||(r.cest&&!/^\d{7}$/.test(r.cest))||(r.origem&&!/^[0-8]$/.test(r.origem)))
   return ret('revisar','Formato incorreto de NCM, CEST ou origem.')
  if(r.gtin&&!gtinValido(r.gtin))return ret('revisar','GTIN inválido. Confira zeros à esquerda.')
  const direct=r.zettaProCod&&Number.isSafeInteger(Number(r.zettaProCod))?byId.get(Number(r.zettaProCod)):undefined
  const matches=direct?[direct]:(r.gtin?byGtin.get(r.gtin)||[]:[])
  if(!matches.length)return ret('sem_vinculo','Sem vínculo exato pelo código Zetta ou GTIN.')
  if(matches.some(p=>eKit(p.nome)&&!eKit(r.descricao)))return ret('revisar','Anúncio de kit/quantidade diferente: conferência manual.')
  if(r.gtin&&matches.some(p=>p.gtinFiscal&&p.gtinFiscal!==r.gtin&&p.sku!==r.gtin))
   return ret('conflito','GTIN já preenchido é divergente.')
  if(matches.some(p=>!igualOuVazio(p.ncm,r.ncm)||!igualOuVazio(p.cest,r.cest)||!igualOuVazio(p.origem,r.origem)))
   return ret('conflito','Há NCM, CEST ou origem divergente. Não sobrescrever.')
  const key=r.zettaProCod?'id:'+r.zettaProCod:'gtin:'+r.gtin
  if(vistos.has(key))return ret('duplicado','Linha repetida. Revisar antes de importar.')
  vistos.add(key)
  const alt=matches.map(p=>{
   const campos:CandidatoImportacao['alteracoes'][number]['campos']={}
   if(!p.ncm&&r.ncm)campos.ncm=r.ncm
   if(!p.cest&&r.cest)campos.cest=r.cest
   if(!p.origem&&r.origem)campos.origem=r.origem
   if(!p.gtinFiscal&&r.gtin)campos.gtinFiscal=r.gtin
   return {produtoId:p.id,campos}
  }).filter(x=>Object.keys(x.campos).length>0)
  if(!alt.length)return ret('sem_dados','Campos já preenchidos.')
  return {...base,status:'apto',motivo:'Vínculo exato. Importará somente campos vazios.',
   produtoIds:matches.map(p=>p.id),alteracoes:alt}
 })
}
