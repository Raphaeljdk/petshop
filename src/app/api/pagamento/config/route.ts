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

    const envEnabled = process.env.MERCADO_PAGO_ENABLED?.trim().toLowerCase()
    const tokenEnvConfigurado = Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim())
    const mercadoPagoAtivoEfetivo =
      envEnabled === 'true'
        ? true
        : envEnabled === 'false'
          ? false
          : tokenEnvConfigurado || config.mercadoPagoAtivo

    const publicKeyEfetiva =
      process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY?.trim() ||
      config.mercadoPagoPublicKey ||
      null

    const accessTokenConfigurado =
      tokenEnvConfigurado ||
      Boolean(config.mercadoPagoAccessToken?.trim())
    const publicKeyConfigurada = Boolean(publicKeyEfetiva?.trim())
    const checkoutPronto =
      mercadoPagoAtivoEfetivo &&
      accessTokenConfigurado &&
      publicKeyConfigurada
    const webhookSecretConfigurado = Boolean(
      process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim()
    )

    if (usuario.role === 'ADMIN') {
      // Admin vê tudo, mas mascaramos tokens parciais
      const resposta: ConfiguracaoPagamento = {
        ...config,
        mercadoPagoAtivo: mercadoPagoAtivoEfetivo,
        // Credenciais reais devem ficar no ambiente do servidor, não expostas pela API.
        mercadoPagoAccessToken: tokenEnvConfigurado ? null : config.mercadoPagoAccessToken,
        mercadoPagoPublicKey: publicKeyEfetiva,
        publicKey: publicKeyEfetiva,
        ambienteConfigurado: tokenEnvConfigurado,
        accessTokenConfigurado,
        publicKeyConfigurada,
        checkoutPronto,
        webhookSecretConfigurado,
      }
      return NextResponse.json(resposta)
    }

    // Cliente vê apenas flags + indicador de modo simulado
    const tokenConfigurado = accessTokenConfigurado
    const ehSimulado = !mercadoPagoAtivoEfetivo || !tokenConfigurado

    return NextResponse.json({
      mercadoPagoAtivo: mercadoPagoAtivoEfetivo,
      pixAtivo: config.pixAtivo,
      cartaoAtivo: config.cartaoAtivo,
      boletoAtivo: config.boletoAtivo,
      simulado: ehSimulado,
      publicKey: publicKeyEfetiva,
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
