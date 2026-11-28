import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado, getUsuarioLogado } from '@/lib/auth-helpers'
import { getOpcaoFrete, normalizarCep, validarCep } from '@/lib/frete'
import {
  cotarMelhorEnvio,
  melhorEnvioConfigurado,
  melhorEnvioDefaultPackage,
} from '@/lib/melhor-envio'
import { emitWebSocket } from '@/lib/realtime'
import {
  calcularComissaoCupom,
  CupomValidationError,
  validarCupom,
} from '@/lib/cupons'
import { assertSameOrigin, AuthError } from '@/lib/auth-http'
import { isServiceProduct, officialStockFromSources } from '@/lib/product-stock'
import { reserveGiftCredit,GiftCreditError,moneyCents } from '@/lib/portal-gift-credit'
import { ensureFiscalDraftForSale } from '@/lib/fiscal-drafts'
import { awardReferralBySale } from '@/lib/portal-referral-awards'
import { debitForSale } from '@/lib/sale-stock-policy'
import { syncStockAfterHubWrite } from '@/lib/stock-sync-after-write'

class CheckoutError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

export async function POST(req: NextRequest) {
  try {
    const cliente = await getClienteLogado()
    if (!cliente) {
      return NextResponse.json(
        { error: 'Cliente não autenticado' },
        { status: 401 }
      )
    }

    assertSameOrigin(req)
    const body = await req.json()
    const {
      itens,
      observacoes,
      tipoEntrega,
      cepEntrega,
      enderecoEntrega,
      melhorEnvioServiceId,
      cupomCodigo,
      valePresenteCodigo, comandaProcessoId, comandaCompraKey,
    } = body as {
      itens: Array<{ produtoId: string; quantidade: number }>
      observacoes?: string
      tipoEntrega?: 'retirada' | 'entrega_propria' | 'sedex' | 'melhor_envio' | null
      cepEntrega?: string
      enderecoEntrega?: string
      melhorEnvioServiceId?: string | null
      cupomCodigo?: string | null
      valePresenteCodigo?: string | null
      comandaProcessoId?: string
      comandaCompraKey?: string
    }

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio' }, { status: 400 })
    }

    if (
      itens.some(
        (item) =>
          !item.produtoId ||
          !Number.isInteger(item.quantidade) ||
          item.quantidade <= 0
      )
    ) {
      return NextResponse.json(
        { error: 'Há itens inválidos no carrinho.' },
        { status: 400 }
      )
    }

    if (!tipoEntrega) {
      return NextResponse.json(
        { error: 'Selecione uma opção de entrega' },
        { status: 400 }
      )
    }

    if (comandaProcessoId || comandaCompraKey) {
      if (typeof comandaProcessoId !== 'string' || comandaProcessoId.length>100 || typeof comandaCompraKey !== 'string' || !/^[a-f0-9-]{36}$/i.test(comandaCompraKey) || tipoEntrega!=='retirada' || cupomCodigo || valePresenteCodigo)
        throw new CheckoutError('Dados inválidos da compra em atendimento.')
      const existing=await db.venda.findFirst({where:{comandaCompraKey,comandaProcessoId,clienteId:cliente.id},select:{id:true,total:true,status:true}})
      if(existing)return NextResponse.json(existing)
      const processo=await db.processo.findFirst({where:{id:comandaProcessoId,pet:{clienteId:cliente.id},status:{in:['em_andamento','aguardando_resposta']},OR:[{ficha:null},{ficha:{is:{checkinStatus:'aceito',checkoutFinalizadoAt:null}}}]},select:{id:true}})
      if(!processo)throw new CheckoutError('Atendimento não está aberto para compras.',409)
    }
    const ids = [...new Set(itens.map((item) => item.produtoId))]
    const produtosLocais = await db.produto.findMany({
      where: { id: { in: ids } },
    })

    const byId = new Map(produtosLocais.map((produto) => [produto.id, produto]))
    if (byId.size !== ids.length) {
      throw new CheckoutError('Um ou mais produtos não foram encontrados.', 404)
    }

    // ---------- Frete ----------
    // Tipos aceitos e valor correspondente confirmado no backend.
    let valorFrete = 0
    let prazoEntrega: string | null = null
    let cepFinal: string | null = null
    let enderecoFinal: string | null = null

    const tipo = (tipoEntrega || '').toString()

    if (tipo === 'retirada') {
      const opcao = await getOpcaoFrete('', 'retirada')
      if (!opcao?.disponivel) throw new CheckoutError('Retirada indisponível no momento.')
      valorFrete = 0
      prazoEntrega = opcao.prazo
      cepFinal = null
      enderecoFinal = null
    } else if (tipo === 'entrega_propria' || tipo === 'sedex') {
      if (!cepEntrega || !validarCep(cepEntrega)) {
        throw new CheckoutError('CEP de entrega inválido')
      }

      const cepNormalizado = normalizarCep(cepEntrega)
      const opcao = await getOpcaoFrete(cepNormalizado, tipo)

      if (!opcao || !opcao.disponivel) {
        throw new CheckoutError(
          tipo === 'entrega_propria'
            ? 'Entrega própria não disponível para este CEP (fora da área de cobertura)'
            : 'Sedex indisponível no momento'
        )
      }

      valorFrete = opcao.valor
      prazoEntrega = opcao.prazo
      cepFinal = cepNormalizado
      enderecoFinal = enderecoEntrega?.trim() || cliente.endereco || null
    } else if (tipo === 'melhor_envio') {
      if (!melhorEnvioConfigurado()) {
        throw new CheckoutError('Melhor Envio ainda não está configurado.')
      }
      if (!cepEntrega || !validarCep(cepEntrega)) {
        throw new CheckoutError('CEP de entrega inválido')
      }
      if (!melhorEnvioServiceId) {
        throw new CheckoutError('Selecione uma opção de entrega do Melhor Envio.')
      }

      const cepNormalizado = normalizarCep(cepEntrega)
      const cotacoes = await cotarMelhorEnvio(
        cepNormalizado,
        melhorEnvioDefaultPackage()
      )
      const opcao = cotacoes.find(
        (item) => item.melhorEnvioServiceId === String(melhorEnvioServiceId)
      )

      if (!opcao?.disponivel) {
        throw new CheckoutError('Opção do Melhor Envio indisponível no momento.')
      }

      valorFrete = opcao.valor
      prazoEntrega = opcao.prazo
      cepFinal = cepNormalizado
      enderecoFinal = enderecoEntrega?.trim() || cliente.endereco || null
    } else {
      throw new CheckoutError('Tipo de entrega inválido')
    }

    if (tipo !== 'retirada' && !enderecoFinal) {
      throw new CheckoutError('Informe o endereço de entrega')
    }

    // ---------- Validação final de preço e estoque ----------
    // Produtos e preços são validados no Hub Matilha Prado antes da reserva;
    // a transação confirma o saldo novamente para impedir concorrência.
    const itensValidados = await Promise.all(
      itens.map(async (item) => {
        const produto = byId.get(item.produtoId)
        if (!produto || !produto.ativo || (comandaProcessoId && isServiceProduct(produto))) {
          throw new CheckoutError('Produto não encontrado ou indisponível.', 404)
        }

        // O Hub Matilha Prado é a única fonte de estoque e preço operacional.
        // Nunca consultar Zetta/Siggma no checkout nem repor cache importado.
        const estoqueDisponivel = officialStockFromSources(produto)
        if (!produto.estoqueIlimitado && estoqueDisponivel < item.quantidade) {
          throw new CheckoutError(
            `Estoque insuficiente para ${produto.nome}. Disponível: ${estoqueDisponivel}.`
          )
        }

        return {
          produtoId: produto.id,
          quantidade: item.quantidade,
          precoUnit: produto.precoPromo ?? produto.preco,
          estoqueConfirmado: estoqueDisponivel,
        }
      })
    )

    // ---------- Venda ----------
    const venda = await db.$transaction(async (tx) => {
      if(comandaProcessoId){
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'comanda:'+comandaProcessoId}))`
        const existente=await tx.venda.findUnique({where:{comandaCompraKey},select:{id:true}})
        if(existente)throw new CheckoutError('Esta compra já foi registrada. Abra a comanda para continuar o pagamento.',409)
        const ativo=await tx.processo.findFirst({where:{id:comandaProcessoId,pet:{clienteId:cliente.id},status:{in:['em_andamento','aguardando_resposta']},OR:[{ficha:null},{ficha:{is:{checkinStatus:'aceito',checkoutFinalizadoAt:null}}}]},select:{id:true}})
        if(!ativo)throw new CheckoutError('Atendimento encerrado.',409)
      }
      // A personal loyalty benefit can be reserved by only one checkout at a time.
      if (cupomCodigo?.trim().toUpperCase().startsWith('CLUBE-') ||
          cupomCodigo?.trim().toUpperCase().startsWith('INDIQUE-')) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cliente.id}))`
      }
      let subtotal = 0
      const itensData: Array<{
        produtoId: string
        quantidade: number
        precoUnit: number
      }> = []

      for (const item of itensValidados) {
        const produto = await tx.produto.findUnique({
          where: { id: item.produtoId },
        })

        if (!produto || !produto.ativo) {
          throw new CheckoutError('Produto não encontrado ou inativo.')
        }

        // Todos os produtos físicos, inclusive cadastros legados Zetta,
        // consomem o saldo ÚNICO do Hub. Uma venda equivale a uma baixa (-Q).
        if(!produto.estoqueIlimitado){
          const baixou=await tx.produto.updateMany({
            where:{id:item.produtoId,ativo:true,estoque:{gte:item.quantidade}},
            data:{estoque:debitForSale(item.quantidade)},
          })
          if(baixou.count!==1)
            throw new CheckoutError('Estoque insuficiente ou alterado para '+produto.nome+
              '. Atualize o carrinho e tente novamente.',409)
          const atualizado=await tx.produto.findUniqueOrThrow({
            where:{id:item.produtoId},select:{estoque:true},
          })
          await tx.produto.update({where:{id:item.produtoId},
            data:{estoqueHub:atualizado.estoque}})
        }

        subtotal += item.precoUnit * item.quantidade
        itensData.push({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnit: item.precoUnit,
        })
      }

      const cupomAplicado = cupomCodigo?.trim()
        ? await validarCupom(tx, {
            codigo: cupomCodigo,
            subtotal,
            clienteId: cliente.id,
          })
        : null

      const descontoCupom = cupomAplicado?.desconto ?? 0
      const valorProdutosLiquido = Math.max(0, subtotal - descontoCupom)
      const total = valorProdutosLiquido + valorFrete
      const totalCents = moneyCents(total)
      if(!Number.isSafeInteger(totalCents)||totalCents<=0)throw new CheckoutError('Total inválido.')

      const novaVenda = await tx.venda.create({
        data: {
          clienteId: cliente.id,
          ...(comandaProcessoId ? {comandaProcessoId,comandaCompraKey} : {}),
          total,
          subtotalProdutos: subtotal,
          cupomId: cupomAplicado?.cupom.id ?? null,
          cupomCodigo: cupomAplicado?.codigo ?? null,
          descontoCupom,
          canal: 'site',
          status: 'pendente',
          observacoes: comandaProcessoId ? 'Separar produtos para entrega junto ao pet no atendimento '+comandaProcessoId : observacoes || null,
          tipoEntrega: tipo,
          valorFrete,
          cepEntrega: cepFinal,
          enderecoEntrega: enderecoFinal,
          prazoEntrega,
          codigoRastreio: null,
          statusEntrega: 'pendente',
          itens: { create: itensData },
        },
        include: {
          cliente: true,
          cupom: true,
          itens: { include: { produto: true } },
        },
      })

      if(valePresenteCodigo?.trim()) {
        const logged=await getUsuarioLogado()
        if(!logged || logged.role!=='CLIENTE' || logged.clienteId!==cliente.id)
          throw new CheckoutError('Conta não autorizada para resgatar este vale.',403)
        const credit=await reserveGiftCredit(tx,valePresenteCodigo,cliente.id,logged.email,totalCents,novaVenda.id)
        await tx.venda.update({where:{id:novaVenda.id},data:{
          creditoPresenteCentavos:credit,
          ...(credit===totalCents ? {status:'concluida',mercadoPagoStatus:'paid_gift'} : {}),
        }})
        // Reflect committed credit in response without changing the gross fiscal total.
        novaVenda.creditoPresenteCentavos=credit
        if(credit===totalCents) {novaVenda.status='concluida';novaVenda.mercadoPagoStatus='paid_gift'}
      }
      if (cupomAplicado) {
        await tx.cupomUso.create({
          data: {
            cupomId: cupomAplicado.cupom.id,
            vendaId: novaVenda.id,
            clienteId: cliente.id,
            codigo: cupomAplicado.codigo,
            desconto: descontoCupom,
            comissao: calcularComissaoCupom(
              valorProdutosLiquido,
              cupomAplicado.cupom.comissaoPercentual
            ),
          },
        })
      }

      return novaVenda
    })

    if(venda.status==='concluida' && venda.mercadoPagoStatus==='paid_gift'){
      try {await awardReferralBySale(venda.id)}
      catch(err){console.error('[checkout] benefício de indicação pendente:',err)}
      try {await ensureFiscalDraftForSale(venda.id)}
      catch(err){console.error('[checkout] rascunho fiscal do vale-presente:',err)}
    }
    const movimentados=[...new Set(venda.itens
      .filter((item)=>!item.produto.estoqueIlimitado).map((item)=>item.produtoId))]
    const marketplaceSync=await syncStockAfterHubWrite(movimentados)
    await emitWebSocket('venda:nova', {
      id: venda.id,
      total: venda.total,
      canal: venda.canal,
      clienteId: cliente.id,
      cupomCodigo: venda.cupomCodigo,
      descontoCupom: venda.descontoCupom,
    })

    return NextResponse.json(
      {
        ...venda,
        marketplaceSync,
        createdAt: venda.createdAt.toISOString(),
        updatedAt: venda.updatedAt.toISOString(),
        cliente: venda.cliente
          ? {
              ...venda.cliente,
              createdAt: venda.cliente.createdAt.toISOString(),
              updatedAt: venda.cliente.updatedAt.toISOString(),
            }
          : null,
        cupom: venda.cupom
          ? {
              ...venda.cupom,
              inicioEm: venda.cupom.inicioEm?.toISOString() ?? null,
              fimEm: venda.cupom.fimEm?.toISOString() ?? null,
              createdAt: venda.cupom.createdAt.toISOString(),
              updatedAt: venda.cupom.updatedAt.toISOString(),
            }
          : null,
      },
      { status: 201 }
    )
  } catch (e) {
    if(e instanceof AuthError) return NextResponse.json({error:e.message},{status:e.status})
    if(e instanceof GiftCreditError) return NextResponse.json({error:e.message},{status:e.status})
    if (e instanceof CupomValidationError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    if (e instanceof CheckoutError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }

    console.error('cliente/carrinho POST erro:', e)
    return NextResponse.json(
      { error: 'Erro ao finalizar compra' },
      { status: 500 }
    )
  }
}
