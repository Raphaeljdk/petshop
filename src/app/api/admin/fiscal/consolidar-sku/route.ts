import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { AuthError, readAuthBody } from '@/lib/auth-http'
import { planejarCompartilhamentoFiscal, type ProdutoSkuFiscal } from '@/lib/fiscal-sku-reuse'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const headers={'Cache-Control':'private, no-store'} as const
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers})
const select={
  id:true,sku:true,nome:true,zettaProCod:true,mlItemId:true,amazonAsin:true,
  ncm:true,cest:true,gtinFiscal:true,cfop:true,csosn:true,pisCst:true,cofinsCst:true,
} as const
function digest(rows:ProdutoSkuFiscal[]){
  const sorted=[...rows].sort((a,b)=>a.id.localeCompare(b.id))
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex')
}
export async function POST(req:NextRequest){
  const user=await getUsuarioLogado()
  if(!user)return reply({error:'Não autenticado.'},401)
  if(user.role!=='ADMIN')return reply({error:'Apenas administradores podem consolidar classificações.'},403)
  try{
    const input=await readAuthBody(req) as Record<string,unknown>
    if(!input||!['simular','aplicar'].includes(String(input.modo||'')))
      return reply({error:'Modo inválido.'},400)
    const rows=await db.produto.findMany({select})
    const planos=planejarCompartilhamentoFiscal(rows)
    const aptos=planos.filter(p=>p.elegivel&&p.atualizacoes.length>0)
    const conflicts=planos.filter(p=>p.razoes.length>0||p.conflitosTributarios.length>0)
    const hash=digest(rows)
    const base={
      hash,
      resumo:{
        anuncios:rows.length,
        skusDistintos:new Set(rows.map(x=>x.sku)).size,
        gruposDuplicados:planos.length,
        gruposParaReaproveitar:aptos.length,
        anunciosComCamposDocumentaisVazios:aptos.reduce((n,p)=>n+p.atualizacoes.length,0),
        preenchimentosPendentes:aptos.reduce((n,p)=>n+p.atualizacoes.reduce((m,a)=>m+Object.keys(a.campos).length,0),0),
        gruposParaConferencia:conflicts.length,
      },
      amostras:planos.filter(x=>x.atualizacoes.length||x.razoes.length||x.conflitosTributarios.length)
        .slice(0,100).map(x=>({
          sku:x.sku,anuncios:x.anuncios,aplicaveis:x.atualizacoes.length,
          campos:[...new Set(x.atualizacoes.flatMap(a=>Object.keys(a.campos)))],
          bloqueios:x.razoes,conflitosTributarios:x.conflitosTributarios,
        })),
      aviso:'São compartilhados somente NCM, CEST e GTIN já comprovados por outro anúncio do mesmo SKU, sem conflito. CFOP, CSOSN, PIS, COFINS e outros impostos NÃO serão replicados: dependem do cenário da venda. Não altera preços, estoque ou anúncios.',
    }
    if(input.modo==='simular')return reply({...base,aplicados:null})
    if(input.hash!==hash||input.confirmacao!=='AUTORIZO_APENAS_CAMPOS_DOCUMENTAIS')
      return reply({error:'Confira a simulação atualizada e confirme novamente antes de aplicar.'},409)
    const targetCount=aptos.reduce((n,x)=>n+x.atualizacoes.length,0)
    if(targetCount>350)return reply({error:'Há mais de 350 registros a atualizar. Divida em lotes.'},400)
    let aplicados=0,camposPreenchidos=0,ignorados=0
    for(const plano of aptos){
      // Revalidar todos os irmãos com transação serializável por SKU para impedir
      // sobrescrita silenciosa se alguém estiver digitando os impostos ao mesmo tempo.
      try{
        const n=await db.$transaction(async tx=>{
          const latest=await tx.produto.findMany({where:{sku:plano.sku},select})
          const current=planejarCompartilhamentoFiscal(latest).find(p=>p.sku===plano.sku)
          if(!current||!current.elegivel||!current.atualizacoes.length)return {registros:0,campos:0}
          let count=0,fields=0
          for(const target of current.atualizacoes){
            const changes=Object.keys(target.campos) as Array<keyof typeof target.campos>
            if(!changes.length)continue
            const before=latest.find(x=>x.id===target.id)
            if(!before)continue
            const updated=await tx.produto.updateMany({
              where:{id:target.id,AND:changes.map(c=>({OR:[{[c]:null},{[c]:''}]}))},
              data:target.campos,
            })
            if(updated.count!==1)continue
            await tx.importacaoFiscalProduto.create({data:{
              produtoId:target.id,sku:plano.sku,
              fonte:'REAPROVEITAMENTO_DOCUMENTAL_SKU',arquivo:'consolidacao-por-sku',
              hashArquivo:hash,linha:0,camposAlterados:changes.join(','),
              ncmAnterior:before.ncm,ncmNovo:target.campos.ncm??null,
              cestAnterior:before.cest,cestNovo:target.campos.cest??null,
              gtinAnterior:before.gtinFiscal,gtinNovo:target.campos.gtinFiscal??null,
              origemAnterior:null,origemNova:null,
            }})
            count++;fields+=changes.length
          }
          return {registros:count,campos:fields}
        },{isolationLevel:'Serializable',timeout:15000,maxWait:5000})
        aplicados+=n.registros;camposPreenchidos+=n.campos
      }catch(e){
        console.warn('SKU fiscal não consolidado por concorrência/conflito',plano.sku,e instanceof Error?e.message:'unknown')
        ignorados++
      }
    }
    return reply({...base,aplicados,camposPreenchidos,ignorados,
      aviso:'Identificações documentais reaproveitadas em campos vazios e auditadas. CFOP, CSOSN, PIS, COFINS e demais regras tributárias não foram replicadas. A emissão de NF-e continua bloqueada.'})
  }catch(e){
    if(e instanceof AuthError)return reply({error:e.message},e.status)
    console.error('Consolidação documental por SKU indisponível',e)
    return reply({error:'Não foi possível concluir a consolidação. Confira permissões e migrações.'},500)
  }
}
