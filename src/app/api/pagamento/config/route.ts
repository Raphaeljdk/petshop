import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { getOuCriarConfigPagamento } from '@/lib/mercado-pago'
import type { ConfiguracaoPagamento } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/pagamento/config
 *
 * Retorna as configurações de pagamento. Para ADMIN, retorna tudo.
 * Para CLIENTE, retorna apenas flags de quais métodos estão ativos
 * (para o checkout saber quais opções mostrar).
 */
export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const config = await getOuCriarConfigPagamento()

    if (usuario.role === 'ADMIN') {
      // Admin vê tudo, mas mascaramos tokens parciais
      const resposta: ConfiguracaoPagamento = {
        ...config,
        // Mantém tokens visíveis para admin editar (mascarado só no front)
        mercadoPagoAccessToken: config.mercadoPagoAccessToken,
        mercadoPagoPublicKey: config.mercadoPagoPublicKey,
      }
      return NextResponse.json(resposta)
    }

    // Cliente vê apenas flags + indicador de modo simulado
    const ehSimulado =
      !config.mercadoPagoAtivo ||
      ((!config.mercadoPagoAccessToken ||
        !config.mercadoPagoAccessToken.trim() ||
        config.mercadoPagoAccessToken.includes('xxxxxxxx')) &&
        (!process.env.MERCADO_PAGO_ACCESS_TOKEN ||
          process.env.MERCADO_PAGO_ACCESS_TOKEN.includes('xxxxxxxx')))

    return NextResponse.json({
      mercadoPagoAtivo: config.mercadoPagoAtivo,
      pixAtivo: config.pixAtivo,
      cartaoAtivo: config.cartaoAtivo,
      boletoAtivo: config.boletoAtivo,
      simulado: ehSimulado,
    })
  } catch (e) {
    console.error('[pagamento/config GET] erro:', e)
    return NextResponse.json({ error: 'Erro ao carregar configurações' }, { status: 500 })
  }
}

/**
 * PUT /api/pagamento/config (apenas ADMIN)
 */
export async function PUT(req: NextRequest) {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await req.json()
    const {
      mercadoPagoAtivo,
      mercadoPagoAccessToken,
      mercadoPagoPublicKey,
      mercadoPagoSandbox,
      pixAtivo,
      cartaoAtivo,
      boletoAtivo,
    } = body as Record<string, unknown>

    const configAtual = await getOuCriarConfigPagamento()

    const dados: Record<string, unknown> = {}
    if (typeof mercadoPagoAtivo === 'boolean')
      dados.mercadoPagoAtivo = mercadoPagoAtivo
    if (typeof mercadoPagoSandbox === 'boolean')
      dados.mercadoPagoSandbox = mercadoPagoSandbox
    if (typeof pixAtivo === 'boolean') dados.pixAtivo = pixAtivo
    if (typeof cartaoAtivo === 'boolean') dados.cartaoAtivo = cartaoAtivo
    if (typeof boletoAtivo === 'boolean') dados.boletoAtivo = boletoAtivo

    // Tokens só atualizamos se vier valor não-vazio (não salvamos string vazia)
    if (typeof mercadoPagoAccessToken === 'string') {
      const v = mercadoPagoAccessToken.trim()
      if (v) dados.mercadoPagoAccessToken = v
      // se vazio, mantém o que já tinha
    }
    if (typeof mercadoPagoPublicKey === 'string') {
      const v = mercadoPagoPublicKey.trim()
      if (v) dados.mercadoPagoPublicKey = v
    }

    const atualizado = await db.configuracaoPagamento.update({
      where: { id: configAtual.id },
      data: dados,
    })

    const resposta: ConfiguracaoPagamento = {
      ...atualizado,
      createdAt: atualizado.createdAt.toISOString(),
      updatedAt: atualizado.updatedAt.toISOString(),
    }

    return NextResponse.json(resposta)
  } catch (e) {
    console.error('[pagamento/config PUT] erro:', e)
    return NextResponse.json({ error: 'Erro ao atualizar configurações' }, { status: 500 })
  }
}
