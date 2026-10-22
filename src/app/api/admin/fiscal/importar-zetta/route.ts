import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { AuthError, assertSameOrigin } from '@/lib/auth-http'
import { lerCsvFiscalZetta, simularImportacaoFiscalZetta } from '@/lib/fiscal-importacao-zetta'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const responder=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}})

export async function POST(req:NextRequest){
  const user=await getUsuarioLogado()
  if(!user)return responder({error:'Não autenticado.'},401)
  if(user.role!=='ADMIN')return responder({error:'Acesso restrito ao administrador.'},403)
  try {
    assertSameOrigin(req)
    if(!req.headers.get('content-type')?.startsWith('application/json'))return responder({error:'Envie CSV no formato JSON.'},415)
    const bodyText=await req.text()
    if(Buffer.byteLength(bodyText,'utf8')>700_000)return responder({error:'Arquivo excessivo. Exporte em lotes de até 600 KB.'},413)
    let input:unknown
    try{input=JSON.parse(bodyText)}catch{return responder({error:'JSON inválido.'},400)}
    if(!input||typeof input!=='object')return responder({error:'Formulário inválido.'},400)
    const payload=input as Record<string,unknown>
    const csv=typeof payload.csv==='string'?payload.csv:''
    const arquivo=typeof payload.arquivo==='string'?payload.arquivo.trim().slice(0,100):''
    const modo=payload.modo==='aplicar'?'aplicar':'simular'
    if(!/^[\w .()\-À-ÿ]+\.csv$/i.test(arquivo))return responder({error:'Envie arquivo CSV válido.'},400)
    const linhas=lerCsvFiscalZetta(csv)
    const hash=createHash('sha256').update(csv,'utf8').digest('hex')
    const produto=await db.produto.findMany({
      select:{id:true,nome:true,sku:true,zettaProCod:true,ncm:true,cest:true,gtinFiscal:true,origem:true},
    })
    const analise=simularImportacaoFiscalZetta(linhas,produto)
    const status=analise.reduce<Record<string,number>>((m,x)=>(m[x.status]=(m[x.status]||0)+1,m),{})
    const totais={linhas:linhas.length,aptas:status.apto||0,semVinculo:status.sem_vinculo||0,
      conflitos:status.conflito||0,revisar:status.revisar||0,duplicadas:status.duplicado||0,
      semDados:status.sem_dados||0,produtosAlvo:new Set(analise.flatMap(x=>x.alteracoes.map(c=>c.produtoId))).size}
    const preview={hash,arquivo,totais,linhas:analise.slice(0,100).map(x=>({
      linha:x.linha,status:x.status,motivo:x.motivo,sku:x.sku,descricao:x.descricao,
      registros:x.produtoIds.length,campos:x.alteracoes.flatMap(a=>Object.keys(a.campos)),
    })),aviso:'Simulação fiscal: somente NCM/CEST/GTIN/origem. Não importa CFOP/CSOSN/CST/alíquotas, nem controla estoque ou emite NF-e.'}
    if(modo==='simular')return responder({...preview,aplicados:0})
    if(payload.hash!==hash||payload.confirmacao!=='CONFIRMO_IMPORTACAO_FISCAL')
      return responder({error:'Primeiro confira a simulação e confirme o mesmo arquivo para gravar.'},400)
    const candidatos=analise.filter(x=>x.status==='apto').flatMap(x=>x.alteracoes.map(a=>({
      ...a,linha:x.linha,sku:x.sku,
    })))
    if(candidatos.length>450)return responder({error:'Limite de 450 registros por gravação. Divida o CSV em lotes.'},400)
    let aplicados=0,naoAplicados=0
    for(const c of candidatos){
      const antes=produto.find(p=>p.id===c.produtoId)
      if(!antes){naoAplicados++;continue}
      const fields=Object.keys(c.campos) as Array<keyof typeof c.campos>
      if(!fields.length)continue
      const condicoes=fields.map(field=>({OR:[{[field]:null},{[field]:''}]}))
      const n=await db.$transaction(async tx=>{
        const altered=await tx.produto.updateMany({
          where:{id:antes.id,AND:condicoes},
          data:c.campos,
        })
        if(altered.count!==1)return 0
        await tx.importacaoFiscalProduto.create({data:{
          produtoId:antes.id,sku:antes.sku,fonte:'ZETTA_EXPORTACAO_FISCAL',
          arquivo,hashArquivo:hash,linha:c.linha,
          camposAlterados:fields.join(','),
          ncmAnterior:antes.ncm,ncmNovo:c.campos.ncm||null,
          cestAnterior:antes.cest,cestNovo:c.campos.cest||null,
          gtinAnterior:antes.gtinFiscal,gtinNovo:c.campos.gtinFiscal||null,
          origemAnterior:antes.origem,origemNova:c.campos.origem||null,
        }})
        return 1
      })
      aplicados+=n
      naoAplicados+=1-n
    }
    return responder({...preview,aplicados,naoAplicados,
      aviso:'Gravados somente campos anteriormente vazios, por vínculo exato, com auditoria. CFOP, CSOSN, impostos e emissão real permanecem pendentes.'})
  } catch(e){
    if(e instanceof AuthError)return responder({error:e.message},e.status)
    if(e instanceof Error&&/CSV|Arquivo|Limite|GTIN|NCM/.test(e.message))return responder({error:e.message},400)
    console.error('Erro de importação fiscal Zetta',e)
    return responder({error:'Importação indisponível. Confira se a migração do banco foi executada.'},500)
  }
}
