import {DOMParser} from '@xmldom/xmldom'
import {nfeRealAutorizadaParaEmail,type NfeParaEmail} from './fiscal-nfe-email'

/**
 * DANFE A4 para NF-e 55 REAL já autorizada, a partir do nfeProc oficial.
 * NUNCA cria uma NF-e, chave, protocolo ou XML: imprime somente o que a
 * SEFAZ efetivamente autorizou. Exige validação visual/contábil antes de usar.
 */
export class DanfeError extends Error {}
type No = Element
const ns='http://www.portalfiscal.inf.br/nfe'
const unico=(node:No,tag:string):No=>{
 const arr=node.getElementsByTagNameNS(ns,tag)
 if(arr.length!==1)throw new DanfeError('XML autorizado não contém campo obrigatório: '+tag)
 return arr.item(0)!
}
const talvez=(node:No,tag:string)=>node.getElementsByTagNameNS(ns,tag).item(0)?.textContent?.trim()||''
const campo=(node:No,tag:string)=>unico(node,tag).textContent?.trim()||''
const limpa=(text:string)=>text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim()
const dinheiro=(valor:string)=> {
 const n=Number(valor)
 return Number.isFinite(n)?n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'0,00'
}
const docNum=(v:string)=>v.replace(/\D/g,'')
const agruparChave=(s:string)=>s.replace(/(\d{4})(?=\d)/g,'$1 ').trim()

const BARRAS_CODE128=[
'212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
'221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
'221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
'212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
'231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
'231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
'314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
'112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
'111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
'214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
'114131','311141','411131','211412','211214','211232','2331112',
] as const

export function codificarCode128C(chave:string){
 if(!/^\d{44}$/.test(chave))throw new DanfeError('Chave fiscal inválida para o código de barras.')
 const valores:number[]=[105]
 let soma=105
 for(let i=0;i<chave.length;i+=2){
  const codigo=Number(chave.slice(i,i+2))
  valores.push(codigo);soma+=codigo*(i/2+1)
 }
 valores.push(soma%103,106)
 return valores.map(v=>BARRAS_CODE128[v]).join('')
}

class Pagina {
 comandos:string[]=[]
 t(x:number,y:number,text:string,tam=8,bold=false){
  const content=limpa(text).slice(0,250)
  const pdf=content.replace(/[\\()]/g, '\\$&')
  this.comandos.push('BT /'+(bold?'F2':'F1')+' '+tam+' Tf 1 0 0 1 '+x.toFixed(2)+' '+y.toFixed(2)+' Tm ('+pdf+') Tj ET')
 }
 caixa(x:number,y:number,w:number,h:number){
  this.comandos.push(x+' '+y+' '+w+' '+h+' re S')
 }
 linha(x:number,y:number,x2:number,y2:number){
  this.comandos.push(x+' '+y+' m '+x2+' '+y2+' l S')
 }
 barra(chave:string,x:number,y:number,w:number,h:number){
  const padrao=codificarCode128C(chave),total=[...padrao].reduce((sum,c)=>sum+Number(c),0)
  const largura=w/total
  let pos=x,preto=true
  for(const v of padrao){
   const delta=Number(v)*largura
   if(preto)this.comandos.push(pos.toFixed(2)+' '+y+' '+delta.toFixed(2)+' '+h+' re f')
   pos+=delta;preto=!preto
  }
 }
 linhaTexto(x:number,y:number,label:string,valor:string,w=78){
  this.t(x,y,label.toUpperCase(),6,true)
  this.t(x,y-11,valor.slice(0,w),8)
 }
}

function pdf(paginas:Pagina[]):Buffer{
 const objetos:string[]=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids ['+paginas.map((_,i)=>(5+i*2)+' 0 R').join(' ')+'] /Count '+paginas.length+' >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
 ]
 for(let i=0;i<paginas.length;i++){
  const c=paginas[i].comandos.join('\n')+'\n'
  objetos.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+(6+i*2)+' 0 R >>')
  objetos.push('<< /Length '+Buffer.byteLength(c,'latin1')+' >>\nstream\n'+c+'endstream')
 }
 let texto='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
 const offsets=[0]
 for(const [i,obj] of objetos.entries()){
  offsets.push(Buffer.byteLength(texto,'latin1'))
  texto+=(i+1)+' 0 obj\n'+obj+'\nendobj\n'
 }
 const inicio=Buffer.byteLength(texto,'latin1')
 texto+='xref\n0 '+(objetos.length+1)+'\n0000000000 65535 f \n'
 for(const off of offsets.slice(1))texto+=String(off).padStart(10,'0')+' 00000 n \n'
 texto+='trailer\n<< /Size '+(objetos.length+1)+' /Root 1 0 R >>\nstartxref\n'+inicio+'\n%%EOF\n'
 return Buffer.from(texto,'latin1')
}

export function gerarDanfePdfAutorizado(n:NfeParaEmail):Buffer{
 if(!nfeRealAutorizadaParaEmail(n))
  throw new DanfeError('DANFE indisponível: exige NF-e real autorizada com XML nfeProc e protocolo.')
 const documento=new DOMParser({onError:()=>{throw new DanfeError('XML malformado.')}}).parseFromString(n.xmlAutorizado!,'text/xml')
 const raiz=documento.documentElement
 if(raiz.localName!=='nfeProc'||raiz.namespaceURI!==ns)
  throw new DanfeError('O arquivo não é XML nfeProc da SEFAZ.')
 const nf=unico(raiz,'NFe'),inf=unico(nf,'infNFe'),protocolo=unico(raiz,'infProt')
 const chave=n.chaveAcesso!,serie=campo(unico(inf,'ide'),'serie')
 const numero=campo(unico(inf,'ide'),'nNF')
 if(inf.getAttribute('Id')!=='NFe'+chave||campo(protocolo,'chNFe')!==chave||
   campo(protocolo,'nProt')!==n.protocolo||campo(protocolo,'tpAmb')!=='1'||
   !['100','150'].includes(campo(protocolo,'cStat')))
  throw new DanfeError('DANFE bloqueado: dados divergentes do XML autorizado.')
 const emit=unico(inf,'emit'),dest=unico(inf,'dest')
 const enderecoEmit=unico(emit,'enderEmit'),enderecoDest=unico(dest,'enderDest')
 const ide=unico(inf,'ide'),total=unico(inf,'ICMSTot')
 const itens=Array.from(inf.getElementsByTagNameNS(ns,'det'))
 if(!itens.length||itens.length>990)throw new DanfeError('Quantidade de itens inválida.')
 const paginas:Pagina[]=[]
 const paginasTotal=Math.max(1,Math.ceil(itens.length/16))
 for(let pagina=0;pagina<paginasTotal;pagina++){
  const p=new Pagina()
  p.t(32,812,'DANFE — Documento Auxiliar da Nota Fiscal Eletronica',13,true)
  p.t(32,795,'NF-e 55 | Saida: 1 | Folha '+(pagina+1)+'/'+paginasTotal,8)
  p.t(390,795,'Serie '+serie+' / Numero '+numero,9,true)
  p.caixa(30,714,535,68)
  p.t(38,767,'CHAVE DE ACESSO',7,true)
  p.barra(chave,42,734,510,28)
  p.t(102,721,agruparChave(chave),9,true)
  p.caixa(30,681,535,33)
  p.linhaTexto(38,702,'PROTOCOLO DE AUTORIZACAO',n.protocolo||'')
  p.linhaTexto(360,702,'RECEBIMENTO SEFAZ',talvez(protocolo,'dhRecbto'))
  p.caixa(30,627,535,54)
  p.linhaTexto(38,666,'EMITENTE',campo(emit,'xNome'),96)
  p.linhaTexto(38,644,'CNPJ / IE',docNum(campo(emit,'CNPJ'))+' / '+talvez(emit,'IE'),64)
  p.linhaTexto(260,644,'ENDERECO',campo(enderecoEmit,'xLgr')+', '+campo(enderecoEmit,'nro')+' - '+campo(enderecoEmit,'xMun')+'/'+campo(enderecoEmit,'UF'),60)
  p.caixa(30,568,535,59)
  p.linhaTexto(38,610,'DESTINATARIO / REMETENTE',campo(dest,'xNome'),94)
  p.linhaTexto(38,587,'CPF / CNPJ',docNum(talvez(dest,'CPF')||talvez(dest,'CNPJ')))
  p.linhaTexto(225,587,'ENDERECO',campo(enderecoDest,'xLgr')+', '+campo(enderecoDest,'nro')+' - '+campo(enderecoDest,'xMun')+'/'+campo(enderecoDest,'UF'),66)
  p.caixa(30,527,535,41)
  p.linhaTexto(38,553,'NATUREZA DA OPERACAO',campo(ide,'natOp'),80)
  p.linhaTexto(38,535,'EMISSAO',campo(ide,'dhEmi').replace('T',' ').slice(0,19),30)
  p.linhaTexto(260,535,'VALOR TOTAL DA NF-e', 'R$ '+dinheiro(campo(total,'vNF')),22)
  p.t(32,510,'DADOS DOS PRODUTOS / SERVICOS',9,true)
  p.caixa(30,487,535,16)
  p.t(37,492,'CODIGO / DESCRICAO',7,true)
  p.t(310,492,'NCM',7,true)
  p.t(365,492,'CFOP',7,true)
  p.t(410,492,'QTD',7,true)
  p.t(458,492,'VALOR',7,true)
  p.t(514,492,'TOTAL',7,true)
  const parte=itens.slice(pagina*16,(pagina+1)*16)
  for(const [idx,item] of parte.entries()){
   const prod=unico(item,'prod'),y=470-idx*19
   p.caixa(30,y-7,535,19)
   p.t(37,y, (talvez(prod,'cProd')||'').slice(0,13),6)
   p.t(110,y, campo(prod,'xProd').slice(0,38),6.5)
   p.t(310,y, campo(prod,'NCM'),7)
   p.t(365,y, campo(prod,'CFOP'),7)
   p.t(410,y, campo(prod,'qCom').slice(0,7),7)
   p.t(458,y, dinheiro(campo(prod,'vUnCom')),7)
   p.t(514,y, dinheiro(campo(prod,'vProd')),7)
  }
  p.caixa(30,113,535,48)
  p.linhaTexto(38,144,'BASE ICMS', 'R$ '+dinheiro(talvez(total,'vBC')))
  p.linhaTexto(135,144,'VALOR ICMS','R$ '+dinheiro(talvez(total,'vICMS')))
  p.linhaTexto(240,144,'PIS','R$ '+dinheiro(talvez(total,'vPIS')))
  p.linhaTexto(331,144,'COFINS','R$ '+dinheiro(talvez(total,'vCOFINS')))
  p.linhaTexto(445,144,'NF-e TOTAL','R$ '+dinheiro(campo(total,'vNF')))
  p.t(33,96,'DOCUMENTO AUXILIAR: validade fiscal exclusivamente do XML autorizado da NF-e.',7,true)
  p.t(33,82,'Consulte a chave de acesso no Portal Nacional da NF-e ou na SEFAZ.',7)
  p.t(33,62,'Matilha Prado | Documento gerado a partir do XML autorizado, sem modificar dados fiscais.',7)
  paginas.push(p)
 }
 return pdf(paginas)
}
