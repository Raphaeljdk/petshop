import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'
import {
  getOuCriarConfigPagamento,
  criarPagamento,
} from '@/lib/mercado-pago'
import type { MetodoPagamento, PagamentoCriarResposta } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/pagamento/criar
 *
 * Body: { vendaId, metodo }
 *   metodo = 'pix' | 'cartao' | 'boleto'
 *
 * Cria a preferência de pagamento no Mercado Pago (ou simulado),
 * atualiza a Venda com o ID/URL/QR, e retorna tudo para o cliente.
 */
export async function POST(req: NextRequest) {
  try {
    const cliente = await getClienteLogado()
    if (!cliente) {
      return NextResponse.json(
        { error: 'Cliente não autenticado' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { vendaId, metodo } = body as {
      vendaId?: string
      metodo?: MetodoPagamento
    }

    if (!vendaId) {
      return NextResponse.json(
        { error: 'vendaId é obrigatório' },
        { status: 400 }
      )
    }
    const metodosValidos: MetodoPagamento[] = ['pix', 'cartao', 'boleto']
    if (!metodo || !metodosValidos.includes(metodo)) {
      return NextResponse.json(
        { error: 'metodo inválido (use pix, cartao ou boleto)' },
        { status: 400 }
      )
    }

    // Carrega a venda (garante que pertence ao cliente logado)
    const venda = await db.venda.findUnique({
      where: { id: vendaId },
      include: { itens: { include: { produto: true } } },
    })
    if (!venda) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 })
    }
    if (venda.clienteId && venda.clienteId !== cliente.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // Se já foi aprovada, não deixa criar de novo
    if (venda.mercadoPagoStatus === 'approved' || venda.status === 'concluida') {
      return NextResponse.json(
        {
          error: 'Esta venda já foi paga',
          preferenceId: venda.mercadoPagoId || '',
          initPoint: venda.mercadoPagoPaymentUrl || '',
          simulado: !venda.mercadoPagoId || venda.mercadoPagoId.startsWith('SIM-'),
          mercadoPagoId: venda.mercadoPagoId || undefined,
        },
        { status: 409 }
      )
    }

    const config = await getOuCriarConfigPagamento()

    // Verifica se o método está ativo
    if (metodo === 'pix' && !config.pixAtivo) {
      return NextResponse.json({ error: 'PIX desativado' }, { status: 400 })
    }
    if (metodo === 'cartao' && !config.cartaoAtivo) {
      return NextResponse.json({ error: 'Cartão desativado' }, { status: 400 })
    }
    if (metodo === 'boleto' && !config.boletoAtivo) {
      return NextResponse.json({ error: 'Boleto desativado' }, { status: 400 })
    }

    const itens = venda.itens.map((it) => ({
      produtoId: it.produtoId,
      nome: it.produto?.nome || `Produto ${it.produtoId.slice(-6)}`,
      quantidade: it.quantidade,
      precoUnit: it.precoUnit,
    }))

    // Se a venda tem frete, somamos como item extra para o MP bater o total
    if (venda.valorFrete && venda.valorFrete > 0) {
      itens.push({
        produtoId: 'frete',
        nome: 'Frete',
        quantidade: 1,
        precoUnit: venda.valorFrete,
      })
    }

    const notificationUrl = `${process.env.NEXTAUTH_URL || ''}/api/pagamento/webhook`

    const resultado = await criarPagamento(
      {
        vendaId: venda.id,
        total: venda.total,
        itens,
        metodo,
        notificationUrl,
        externalReference: venda.id,
      },
      config
    )

    // Atualiza a venda com os dados do MP
    const agora = new Date()
    const pixExpiresAt = resultado.pixExpiresAt ? new Date(resultado.pixExpiresAt) : null

    await db.venda.update({
      where: { id: venda.id },
      data: {
        mercadoPagoId: resultado.mercadoPagoId || resultado.preferenceId,
        mercadoPagoStatus: 'pending',
        mercadoPagoPaymentUrl: resultado.initPoint,
        mercadoPagoQrCode:
          resultado.qrCodeBase64 || resultado.pixCopiaECola || null,
        mercadoPagoPixExpiresAt: pixExpiresAt,
        // Marca como pendente aguardando pagamento
        status: 'pendente',
        updatedAt: agora,
      },
    })

    // Se modo simulado, programa a "aprovação automática" via setTimeout
    // (em produção isso viria do webhook do MP)
    if (resultado.simulado) {
      setTimeout(async () => {
        try {
          const v = await db.venda.findUnique({ where: { id: venda.id } })
          if (!v) return
          if (v.mercadoPagoStatus !== 'approved') {
            await db.venda.update({
              where: { id: venda.id },
              data: {
                mercadoPagoStatus: 'approved',
                status: 'concluida',
                updatedAt: new Date(),
              },
            })
            // Emite evento WebSocket para o cliente ser notificado
            try {
              const { emitWebSocket } = await import('@/lib/realtime')
              await emitWebSocket('pagamento:aprovado', {
                vendaId: venda.id,
                simulado: true,
              })
            } catch {}
          }
        } catch (e) {
          console.error('[pagamento/criar] simulado auto-approve erro:', e)
        }
      }, 10_000) // 10 segundos
    }

    const resposta: PagamentoCriarResposta = {
      preferenceId: resultado.preferenceId,
      initPoint: resultado.initPoint,
      qrCode: resultado.qrCodeBase64,
      qrCodeBase64: resultado.qrCodeBase64,
      pixCopiaECola: resultado.pixCopiaECola,
      pixExpiresAt: resultado.pixExpiresAt,
      boletoUrl: resultado.boletoUrl,
      simulado: resultado.simulado,
      mercadoPagoId: resultado.mercadoPagoId,
    }

    return NextResponse.json(resposta, { status: 200 })
  } catch (e: any) {
    console.error('[pagamento/criar] erro:', e)
    return NextResponse.json(
      { error: e?.message || 'Erro ao criar pagamento' },
      { status: 500 }
    )
  }
}
