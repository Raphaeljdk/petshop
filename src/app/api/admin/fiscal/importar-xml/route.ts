import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin, AuthError } from '@/lib/auth-http'
import { lerNotaXmlEntrada, planejarImportacaoXml } from '@/lib/fiscal-xml-entrada'
import { gtinValido } from '@/lib/fiscal-importacao-zetta'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const fonte='XML_NFE_ENTRADA'
const resposta=(v:unknown,s=200)=>NextResponse.json(v,{status:s,headers:{'Cache-Control':'private, no-store'}})
type Escolha={linha:number;acao:'vincular'|'criar';produtoId?:string}
const digits=(s:string)=>s.replace(/\D/g,'')

export async function POST(req:NextRequest){
  const user=await getUsuarioLogado()
  if(!user)return resposta({error:'É necessário entrar como administrador.'},401)
  if(user.role!=='ADMIN')return resposta({error:'Acesso exclusivo da administração.'},403)
  try {
    assertSameOrigin(req)
    if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
      return resposta({error:'Envie o XML em formato JSON.'},415)
    const raw=await req.text()
    if(Buffer.byteLength(raw,'utf8')>1_200_000)return resposta({error:'Arquivo muito grande. Limite: 900 KB por XML.'},413)
    let payload:Record<string,unknown>
    try{payload=JSON.parse(raw)}catch{return resposta({error:'Dados de importação inválidos.'},400)}
    if(!payload||typeof payload!=='object'||Array.isArray(payload))return resposta({error:'Dados inválidos.'},400)
    const xml=typeof payload.xml==='string'?payload.xml:''
    const arquivo=typeof payload.arquivo==='string'?payload.arquivo.trim().slice(0,100):''
    const modo=payload.modo==='aplicar'?'aplicar':'simular'
    if(!/^[\w .()\-À-ÿ]+\.xml$/i.test(arquivo))return resposta({error:'Escolha um arquivo .xml de NF-e.'},400)
    const nota=lerNotaXmlEntrada(xml)
    const config=await db.configuracaoFiscal.findUnique({where:{id:'matilha-prado'},select:{cnpj:true}})
    const cnpjEmpresa=digits(config?.cnpj||'')
    if(cnpjEmpresa.length!==14)return resposta({error:'Cadastre o CNPJ da Matilha Prado em Fiscal > Emitente antes de importar.'},400)
    if(nota.cnpjDestinatario!==cnpjEmpresa||nota.cnpjEmitente===cnpjEmpresa)
      return resposta({error:'Este XML não é uma compra destinada ao CNPJ cadastrado da Matilha Prado.'},400)
    const hash=createHash('sha256').update(xml,'utf8').digest('hex')
    const catalogo=await db.produto.findMany({select:{id:true,nome:true,sku:true,ncm:true,cest:true,gtinFiscal:true}})
    const linhas=planejarImportacaoXml(nota.itens,catalogo)
    const anteriores=await db.importacaoFiscalProduto.count({where:{fonte,arquivo:nota.chave}})
    const status=linhas.reduce<Record<string,number>>((acc,l)=>(acc[l.status]=(acc[l.status]||0)+1,acc),{})
    const total={linhas:linhas.length,aptas:status.apto||0,jaPreenchidos:status.ja_preenchido||0,
      semVinculo:status.sem_vinculo||0,conflitos:status.conflito||0,
      revisar:status.revisar||0,duplicadas:status.duplicado||0}
    const preview={arquivo,hash,nota:{chave:nota.chave,numero:nota.numero,serie:nota.serie,
      fornecedor:nota.emitente,cnpjFornecedor:nota.cnpjEmitente,autorizada:nota.autorizada,
      ambiente:nota.ambiente},jaImportada:anteriores>0,totais:total,
      linhas:linhas.map(p=>({...p,alteracoes:p.alteracoes.map(a=>({produtoId:a.produtoId,campos:a.campos}))})),
      catalogo:catalogo.map(p=>({id:p.id,nome:p.nome,sku:p.sku,gtinFiscal:p.gtinFiscal})),
      aviso:'Importação apenas documental. Nunca altera estoque, preços, CFOP, CSOSN, CST, tributação de saída ou notas já emitidas. Conferir NCM/CEST com a contabilidade.'}
    if(modo==='simular')return resposta(preview)
    if(payload.hash!==hash||payload.confirmacao!=='CONFIRMO_IMPORTACAO_XML')
      return resposta({error:'Simule o mesmo XML e confirme antes de aplicar.'},400)
    if(nota.ambiente!=='1'||!nota.autorizada)
      return resposta({error:'Somente NF-e de compra autorizada em produção pode atualizar o cadastro. XML de teste é somente para prévia.'},400)
    if(anteriores)return resposta({error:'Esta NF-e já possui importação registrada. Nenhum item foi processado novamente.'},409)
    const input=Array.isArray(payload.escolhas)?payload.escolhas:[]
    if(input.length>linhas.length)return resposta({error:'Seleções em excesso.'},400)
    const escolhas=new Map<number,Escolha>()
    for(const item of input){
      if(!item||typeof item!=='object'||!Number.isInteger(item.linha)||
        !['vincular','criar'].includes(item.acao)||escolhas.has(item.linha))
        return resposta({error:'Seleção manual inválida ou repetida.'},400)
      escolhas.set(item.linha,item as Escolha)
    }
    const produtos=new Map(catalogo.map(p=>[p.id,p]))
    const tarefas:Array<{linha:number;produtoId?:string;criar?:boolean;
      campos:{ncm?:string;cest?:string;gtinFiscal?:string};descricao:string}>=[]
    const usados=new Set<string>()
    for(const row of linhas){
      const item=nota.itens[row.linha-1]
      const escolha=escolhas.get(row.linha)
      if(escolha&&row.status!=='sem_vinculo')return resposta({error:'Só é possível associar manualmente itens sem vínculo: linha '+row.linha},400)
      if(['revisar','conflito','duplicado'].includes(row.status))continue
      if(row.status==='apto'){
        for(const a of row.alteracoes){
          if(usados.has(a.produtoId))return resposta({error:'Dois itens tentam alterar o mesmo produto: revise a NF-e.'},400)
          usados.add(a.produtoId)
          tarefas.push({linha:row.linha,produtoId:a.produtoId,campos:a.campos,descricao:row.descricao})
        }
      }else if(row.status==='sem_vinculo'&&escolha){
        if(escolha.acao==='criar'){
          // Cadastro em rascunho, não anunciado e sem saldo comercial.
          tarefas.push({linha:row.linha,criar:true,descricao:item.descricao,campos:{
            ncm:item.ncm,cest:item.cest||undefined,gtinFiscal:item.gtin||undefined,
          }})
        }else{
          const p=produtos.get(escolha.produtoId||'')
          if(!p)return resposta({error:'Produto selecionado não existe: linha '+row.linha},400)
          if(usados.has(p.id))return resposta({error:'Um produto foi associado a mais de um item.'},400)
          if(item.gtin&&((p.gtinFiscal&&p.gtinFiscal!==item.gtin)||
            (p.sku&&gtinValido(p.sku)&&p.sku!==item.gtin)))
            return resposta({error:'GTIN incompatível na associação manual: linha '+row.linha},409)
          if((p.ncm&&p.ncm!==item.ncm)||(p.cest&&item.cest&&p.cest!==item.cest))
            return resposta({error:'Classificação existente divergente: linha '+row.linha},409)
          usados.add(p.id)
          const campos:{ncm?:string;cest?:string;gtinFiscal?:string}={}
          if(!p.ncm)campos.ncm=item.ncm
          if(!p.cest&&item.cest)campos.cest=item.cest
          if(!p.gtinFiscal&&item.gtin)campos.gtinFiscal=item.gtin
          if(Object.keys(campos).length)tarefas.push({linha:row.linha,produtoId:p.id,campos,descricao:row.descricao})
        }
      }
    }
    if(tarefas.length>180)return resposta({error:'Muitos cadastros afetados. Divida em lotes menores.'},400)
    const resultado=await db.$transaction(async tx=>{
      // No banco PostgreSQL, bloqueia importações concorrentes da mesma chave enquanto grava.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${nota.chave}))`
      const repetida=await tx.importacaoFiscalProduto.count({where:{fonte,arquivo:nota.chave}})
      if(repetida)throw new AuthError('NF-e já importada; não duplicamos os registros.',409)
      let atualizados=0,criados=0,ignorados=0
      for(const t of tarefas){
        const item=nota.itens[t.linha-1]
        if(t.criar){
          if(!item.descricao||!/^\d{8}$/.test(item.ncm)||(item.gtin&&!gtinValido(item.gtin)))
            throw new AuthError('Dados incompletos para novo cadastro: linha '+t.linha,400)
          if(item.gtin){
            const existentes=await tx.produto.count({where:{OR:[{sku:item.gtin},{gtinFiscal:item.gtin}]}})
            if(existentes){ignorados++;continue}
          }
          const criado=await tx.produto.create({data:{
            nome:item.descricao,categoria:'Pendente de categorização',preco:0,estoque:0,estoqueHub:0,
            estoqueZetta:0,estoqueMercadoLivre:0,estoqueAmazon:0,ativo:false,
            sku:item.gtin||null,gtinFiscal:item.gtin||null,ncm:item.ncm,cest:item.cest,
          }})
          await tx.importacaoFiscalProduto.create({data:{
            produtoId:criado.id,sku:criado.sku,fonte,arquivo:nota.chave,hashArquivo:hash,linha:t.linha,
            camposAlterados:'CADASTRO_INATIVO,ncm,cest,gtinFiscal',
            ncmNovo:criado.ncm,cestNovo:criado.cest,gtinNovo:criado.gtinFiscal,
          }})
          criados++;continue
        }
        const antigo=produtos.get(t.produtoId||'')
        if(!antigo)continue
        const campos=t.campos
        const chaves=Object.keys(campos) as Array<keyof typeof campos>
        if(!chaves.length)continue
        const updated=await tx.produto.updateMany({
          where:{id:antigo.id,AND:chaves.map(c=>({OR:[{[c]:null},{[c]:''}]}))},
          data:campos,
        })
        if(!updated.count){ignorados++;continue}
        await tx.importacaoFiscalProduto.create({data:{
          produtoId:antigo.id,sku:antigo.sku,fonte,arquivo:nota.chave,hashArquivo:hash,linha:t.linha,
          camposAlterados:chaves.join(','),ncmAnterior:antigo.ncm,ncmNovo:campos.ncm||null,
          cestAnterior:antigo.cest,cestNovo:campos.cest||null,
          gtinAnterior:antigo.gtinFiscal,gtinNovo:campos.gtinFiscal||null,
        }})
        atualizados++
      }
      return {atualizados,criados,ignorados}
    },{timeout:30_000,maxWait:5_000})
    return resposta({...preview,...resultado,
      aviso:'Importação concluída. Produtos novos ficaram inativos, com preço e estoque zerados. Confira seus NCMs com a contabilidade.'})
  }catch(e){
    if(e instanceof AuthError)return resposta({error:e.message},e.status)
    if(e instanceof Error&&/XML|NF-e|nota|Entidade|Entidade|Produto|GTIN|NCM|elemento|Tag|Tags|Arquivo|Documento|documento|Chave|CNPJ/i.test(e.message))
      return resposta({error:e.message},400)
    console.error('Falha importação XML de entrada',e)
    return resposta({error:'Não foi possível concluir a leitura ou gravação do XML.'},500)
  }
}
