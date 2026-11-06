/**
 * Importação documental de NF-e de fornecedores (modelo 55).
 * Leitura segura, limitada e sem rede/entidades externas. NÃO é validador XSD.
 * Nunca converte CFOP/CST/CSOSN/valores de entrada em regras de saída.
 */
import { gtinValido } from '@/lib/fiscal-importacao-zetta'

type Node = { nome:string; texto:string; atributos:Record<string,string>; filhos:Node[] }
export type ItemXmlEntrada = {
  linha:number; codigoFornecedor:string; descricao:string; gtin:string|null;
  ncm:string; cest:string|null; unidade:string; quantidade:string; valor:string;
}
export type NotaXmlEntrada = {
  chave:string; emitente:string; cnpjEmitente:string; cnpjDestinatario:string;
  numero:string; serie:string; ambiente:string; autorizada:boolean;
  itens:ItemXmlEntrada[];
}
export type ProdutoXmlEntrada = {
  id:string; nome:string; sku:string|null; gtinFiscal:string|null;
  ncm:string|null; cest:string|null;
}
export type CampoImportado = 'ncm'|'cest'|'gtinFiscal'
export type PlanoLinhaXml = {
  linha:number; descricao:string; gtin:string|null; ncm:string; cest:string|null;
  status:'apto'|'ja_preenchido'|'sem_vinculo'|'revisar'|'conflito'|'duplicado';
  motivo:string; produtoIds:string[];
  alteracoes:Array<{produtoId:string;campos:Partial<Record<CampoImportado,string>>}>;
}

const soDigitos=(v:string)=>v.replace(/\D/g,'')
const local=(v:string)=>v.split(':').pop()||v
function decodificar(v:string):string{
  if(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(v))throw Error('Entidade XML desconhecida.')
  return v.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g,(_all,id:string)=>{
    if(id==='amp')return '&'
    if(id==='lt')return '<'
    if(id==='gt')return '>'
    if(id==='quot')return '"'
    if(id==='apos')return "'"
    const cp=id[1]?.toLowerCase()==='x'?parseInt(id.slice(2),16):parseInt(id.slice(1),10)
    if(!Number.isFinite(cp)||cp<=0||cp>0x10ffff||(cp>=0xd800&&cp<=0xdfff))throw Error('Entidade XML inválida.')
    return String.fromCodePoint(cp)
  })
}
function parseXml(xml:string):Node{
  if(!xml.trim()||Buffer.byteLength(xml,'utf8')>900_000)throw Error('XML vazio ou maior que 900 KB.')
  // Recusa DTD/ENTITY e qualquer declaração não suportada. Nenhuma consulta externa.
  if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml))throw Error('XML com DTD/entidades não é permitido.')
  const raiz:Node={nome:'#document',texto:'',atributos:{},filhos:[]}
  const pilha=[raiz]
  const token=/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[^<>]*>|[^<]+/g
  let cursor=0,elementos=0
  for(const m of xml.matchAll(token)){
    if(m.index!==cursor)throw Error('XML malformado.')
    cursor+=m[0].length
    const valor=m[0]
    if(valor.startsWith('<?')||valor.startsWith('<!--'))continue
    if(valor.startsWith('<![CDATA[')){
      pilha[pilha.length-1].texto+=valor.slice(9,-3)
      continue
    }
    if(valor.startsWith('<!'))throw Error('Declaração XML não suportada.')
    if(valor.startsWith('</')){
      const nome=local(valor.slice(2,-1).trim())
      if(pilha.length<=1||pilha[pilha.length-1].nome!==nome)throw Error('Tags XML incompatíveis.')
      pilha.pop();continue
    }
    if(valor.startsWith('<')){
      const fechamento=/\/\s*>$/.test(valor)
      const inner=valor.slice(1,fechamento?-2:-1).trim()
      const tag=/^([A-Za-z_][\w:.-]*)(?=\s|$)/.exec(inner)
      if(!tag)throw Error('Tag XML inválida.')
      const attrs:Record<string,string>={}
      const rawAttrs=inner.slice(tag[0].length)
      const attrPattern=/([A-Za-z_][\w:.-]*)\s*=\s*(["'])(.*?)\2/g
      for(const a of rawAttrs.matchAll(attrPattern))attrs[local(a[1])]=decodificar(a[3])
      const node:Node={nome:local(tag[1]),texto:'',atributos:attrs,filhos:[]}
      pilha[pilha.length-1].filhos.push(node)
      if(++elementos>15_000)throw Error('XML com elementos em excesso.')
      if(!fechamento){pilha.push(node);if(pilha.length>40)throw Error('XML com profundidade excessiva.')}
      continue
    }
    pilha[pilha.length-1].texto+=decodificar(valor)
  }
  if(cursor!==xml.length||pilha.length!==1||raiz.filhos.length!==1)throw Error('XML incompleto ou inválido.')
  return raiz.filhos[0]
}
const filho=(n:Node|undefined,nome:string)=>n?.filhos.find(f=>f.nome===nome)
const valor=(n:Node|undefined,nome:string)=>(filho(n,nome)?.texto||'').trim()
const unico=(n:Node,nome:string):Node=>{
  if(n.nome===nome)return n
  const filhos=n.filhos.filter(f=>f.nome===nome)
  if(filhos.length===1)return filhos[0]
  if(filhos.length>1)throw Error('XML contém notas duplicadas.')
  for(const c of n.filhos){try{return unico(c,nome)}catch(e){if(e instanceof Error&&e.message!=='Elemento ausente.')throw e}}
  throw Error('Elemento ausente.')
}
export function lerNotaXmlEntrada(xml:string):NotaXmlEntrada{
  const doc=parseXml(xml)
  const nfe=unico(doc,'NFe')
  const info=filho(nfe,'infNFe')
  if(!info)throw Error('NF-e sem infNFe.')
  const chave=(info.atributos.Id||'').replace(/^NFe/,'')
  if(!/^\d{44}$/.test(chave))throw Error('Chave de NF-e inválida.')
  const ide=filho(info,'ide'),emit=filho(info,'emit'),dest=filho(info,'dest')
  if(valor(ide,'mod')!=='55')throw Error('Apenas NF-e de produtos modelo 55 é aceita (não NFC-e nem NFS-e).')
  if(valor(ide,'tpNF')!=='1')throw Error('Este XML não representa a saída de mercadorias do fornecedor.')
  const cnpjEmitente=soDigitos(valor(emit,'CNPJ'))
  const cnpjDestinatario=soDigitos(valor(dest,'CNPJ'))
  if(!/^\d{14}$/.test(cnpjEmitente)||!/^\d{14}$/.test(cnpjDestinatario))
    throw Error('A nota deve ter CNPJ do fornecedor e do destinatário.')
  const protocolo=doc.nome==='nfeProc'?filho(doc,'protNFe'):undefined
  const infProt=filho(protocolo,'infProt')
  const autorizada=Boolean(infProt&&['100','150'].includes(valor(infProt,'cStat'))&&valor(infProt,'chNFe')===chave)
  const dets=info.filhos.filter(f=>f.nome==='det')
  if(!dets.length||dets.length>150)throw Error('NF-e precisa conter de 1 a 150 produtos para importação.')
  const itens=dets.map((det,index)=>{
    const prod=filho(det,'prod')
    if(!prod)throw Error('Produto ausente na NF-e.')
    const ncm=soDigitos(valor(prod,'NCM'))
    const cest=soDigitos(valor(prod,'CEST'))
    const informado=valor(prod,'cEAN')||valor(prod,'cEANTrib')
    const gtin=informado&&informado.toUpperCase()!=='SEM GTIN'?soDigitos(informado):null
    return {linha:index+1,codigoFornecedor:valor(prod,'cProd').slice(0,80),
      descricao:valor(prod,'xProd').slice(0,180),gtin,ncm,cest:cest||null,
      unidade:valor(prod,'uCom').slice(0,12),quantidade:valor(prod,'qCom'),
      valor:valor(prod,'vProd')}
  })
  return {chave,emitente:valor(emit,'xNome').slice(0,180),cnpjEmitente,
    cnpjDestinatario,numero:valor(ide,'nNF'),serie:valor(ide,'serie'),
    ambiente:valor(ide,'tpAmb'),autorizada,itens}
}
const eKit=(nome:string)=>/\b(?:kit|combo|pack|[2-9]\s?x)\b/i.test(nome)
export function planejarImportacaoXml(itens:ItemXmlEntrada[],catalogo:ProdutoXmlEntrada[]):PlanoLinhaXml[]{
  const mapa=new Map<string,ProdutoXmlEntrada[]>()
  for(const p of catalogo)for(const g of new Set([p.gtinFiscal,p.sku].filter((v):v is string=>!!v))){
    if(!gtinValido(g))continue
    mapa.set(g,[...(mapa.get(g)||[]),p])
  }
  const vistos=new Set<string>()
  return itens.map(item=>{
    const base={linha:item.linha,descricao:item.descricao,gtin:item.gtin,
      ncm:item.ncm,cest:item.cest,produtoIds:[] as string[],
      alteracoes:[] as PlanoLinhaXml['alteracoes']}
    const ret=(status:PlanoLinhaXml['status'],motivo:string):PlanoLinhaXml=>({...base,status,motivo})
    if(!item.descricao||!/^\d{8}$/.test(item.ncm)||(item.cest&&!/^\d{7}$/.test(item.cest)))
      return ret('revisar','Descrição, NCM ou CEST incompleto/inválido na nota.')
    if(item.gtin&&!gtinValido(item.gtin))
      return ret('revisar','GTIN inválido no XML. Não associar automaticamente.')
    if(!item.gtin)return ret('sem_vinculo','Sem GTIN: selecione manualmente o produto existente ou cadastre como novo inativo.')
    if(vistos.has(item.gtin))return ret('duplicado','GTIN repetido nesta nota; revisar antes de gravar.')
    vistos.add(item.gtin)
    const matches=Array.from(new Map((mapa.get(item.gtin)||[]).map(p=>[p.id,p])).values())
    if(!matches.length)return ret('sem_vinculo','GTIN não encontrado no catálogo. Vincule ou cadastre um novo produto.')
    if(matches.some(p=>eKit(p.nome)!==eKit(item.descricao)))
      return ret('revisar','Possível divergência entre kit/combo e item unitário.')
    if(matches.some(p=>(p.ncm&&p.ncm!==item.ncm)||(p.cest&&item.cest&&p.cest!==item.cest)))
      return ret('conflito','NCM/CEST diferente do cadastro existente; não sobrescrever.')
    const alteracoes=matches.map(p=>{
      const campos:Partial<Record<CampoImportado,string>>={}
      if(!p.ncm)campos.ncm=item.ncm
      if(!p.cest&&item.cest)campos.cest=item.cest
      if(!p.gtinFiscal)campos.gtinFiscal=item.gtin!
      return {produtoId:p.id,campos}
    }).filter(x=>Object.keys(x.campos).length)
    if(!alteracoes.length)return {...ret('ja_preenchido','Dados já preenchidos.'),produtoIds:matches.map(p=>p.id)}
    return {...base,status:'apto',motivo:'GTIN exato; preencher apenas campos vazios.',
      produtoIds:matches.map(p=>p.id),alteracoes}
  })
}
