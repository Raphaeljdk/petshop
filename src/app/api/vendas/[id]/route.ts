import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { inventoryActionForSaleStatus,canDeleteSaleWithoutLosingStockHistory } from '@/lib/sale-stock-policy'
import { syncStockAfterHubWrite } from '@/lib/stock-sync-after-write'

const STATUS_VALIDOS = new Set(['concluida', 'pendente', 'cancelada'])
const CANAIS_VALIDOS = new Set(['loja', 'site', 'mercado_livre', 'amazon'])


export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { status, observacoes, canal } = body as {
      status?: string
      observacoes?: string | null
      canal?: string
    }

    if (status !== undefined && !STATUS_VALIDOS.has(status)) {
      return NextResponse.json({ error: 'Status da venda inválido' }, { status: 400 })
    }
    if (canal !== undefined && !CANAIS_VALIDOS.has(canal)) {
      return NextResponse.json({ error: 'Canal da venda inválido' }, { status: 400 })
    }

    const venda = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sale:${id}`}))`

      const atual = await tx.venda.findUnique({
        where: { id },
        include: { itens: { include: { produto: true } } },
      })

      if (!atual) return null

      const statusAtual=String(atual.status)
      const proximoStatus=status ?? statusAtual
      const movimento=inventoryActionForSaleStatus(statusAtual,proximoStatus)
      if(movimento==='manual-review')
        throw new Error('Uma venda cancelada não pode ser reaberta automaticamente. Crie uma nova venda após conferir o estoque físico.')
      if(movimento==='release-reservation'){
        // Venda pendente apenas reservou unidades, sem saída física: devolver ao Hub.
        // NUNCA condicionar o espelho do Hub a saldo anterior positivo.
        for(const item of atual.itens){
          if(!item.produto || item.produto.estoqueIlimitado)continue
          const atualizado=await tx.produto.update({
            where:{id:item.produtoId},
            data:{estoque:{increment:item.quantidade}},
            select:{estoque:true},
          })
          await tx.produto.update({where:{id:item.produtoId},
            data:{estoqueHub:atualizado.estoque}})
        }
      }
      // Cancelamento de venda concluída NÃO significa mercadoria devolvida.
      // Repor apenas por conferência física no cadastro do Hub.

      const dados: any = {}
      if (status !== undefined) dados.status = status
      if (observacoes !== undefined) dados.observacoes = observacoes
      if (canal !== undefined) dados.canal = canal

      const updated=await tx.venda.update({
        where: { id },
        data: dados,
        include: { cliente: true, itens: { include: { produto: true } } },
      })
      return {updated,produtoIds:movimento==='release-reservation'
        ?[...new Set(atual.itens.filter(item=>!item.produto?.estoqueIlimitado).map(item=>item.produtoId))]:[]}
    })

    if (!venda) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
    }

    const sync=await syncStockAfterHubWrite(venda.produtoIds)
    return NextResponse.json({...venda.updated,marketplaceSync:sync})
  } catch (e) {
    console.error('venda PATCH erro:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao atualizar venda' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params

    const deleted=await db.$transaction(async (tx)=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sale:${id}`}))`
      const venda=await tx.venda.findUnique({where:{id},
        include:{itens:{include:{produto:true}}}})
      if(!venda)return {status:'missing' as const,produtoIds:[] as string[]}
      if(!canDeleteSaleWithoutLosingStockHistory(venda))
        return {status:'blocked' as const,produtoIds:[] as string[]}
      const produtoIds:string[]=[]
      if(venda.status==='pendente'){
        // Liberação de reserva de venda pendente; concluídas jamais são deletadas.
        for(const item of venda.itens){
          if(!item.produto||item.produto.estoqueIlimitado)continue
          const atualizado=await tx.produto.update({
            where:{id:item.produtoId},
            data:{estoque:{increment:item.quantidade}},
            select:{estoque:true},
          })
          await tx.produto.update({where:{id:item.produtoId},
            data:{estoqueHub:atualizado.estoque}})
          produtoIds.push(item.produtoId)
        }
      }
      await tx.venda.delete({where:{id}})
      return {status:'deleted' as const,produtoIds:[...new Set(produtoIds)]}
    })
    if(deleted.status==='missing')
      return NextResponse.json({error:'Venda não encontrada'},{status:404})
    if(deleted.status==='blocked')
      return NextResponse.json({error:'Vendas concluídas ou importadas de marketplaces não podem ser excluídas: preserve o histórico. Para devoluções, confira o produto no Hub.'},{status:409})
    const sync=await syncStockAfterHubWrite(deleted.produtoIds)
    return NextResponse.json({success:true,marketplaceSync:sync})
  } catch (e) {
    console.error('venda DELETE erro:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao deletar venda' },
      { status: 500 }
    )
  }
}
