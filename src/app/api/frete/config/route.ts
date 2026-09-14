import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { getOuCriarConfigFrete } from '@/lib/frete'

export const dynamic = 'force-dynamic'

/**
 * GET /api/frete/config
 *
 * Retorna as configurações atuais de frete. Se ainda não existir
 * nenhum registro, cria um com os valores padrão.
 *
 * Acessível para qualquer usuário autenticado (cliente lê as configs
 * para mostrar prazo/endereço de retirada; admin gerencia via PUT).
 */
export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const config = await getOuCriarConfigFrete()
    return NextResponse.json(config)
  } catch (e) {
    console.error('frete/config GET erro:', e)
    return NextResponse.json({ error: 'Erro ao carregar configurações' }, { status: 500 })
  }
}

/**
 * PUT /api/frete/config
 *
 * Atualiza as configurações de frete. Acesso exclusivo de ADMIN.
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
      entregaPropriaAtiva,
      entregaPropriaValor,
      entregaPropriaPrazo,
      entregaPropriaCepInicial,
      entregaPropriaCepFinal,
      sedexAtivo,
      sedexPrazo,
      retiradaAtiva,
      retiradaPrazo,
      retiradaEndereco,
    } = body as Record<string, unknown>

    const configAtual = await getOuCriarConfigFrete()

    const dados: Record<string, unknown> = {}

    if (typeof entregaPropriaAtiva === 'boolean')
      dados.entregaPropriaAtiva = entregaPropriaAtiva
    if (typeof entregaPropriaValor === 'number' && !Number.isNaN(entregaPropriaValor))
      dados.entregaPropriaValor = entregaPropriaValor
    if (typeof entregaPropriaPrazo === 'string' && entregaPropriaPrazo.trim())
      dados.entregaPropriaPrazo = entregaPropriaPrazo.trim()
    if (typeof entregaPropriaCepInicial === 'string' && entregaPropriaCepInicial.trim())
      dados.entregaPropriaCepInicial = entregaPropriaCepInicial.trim()
    if (typeof entregaPropriaCepFinal === 'string' && entregaPropriaCepFinal.trim())
      dados.entregaPropriaCepFinal = entregaPropriaCepFinal.trim()
    if (typeof sedexAtivo === 'boolean') dados.sedexAtivo = sedexAtivo
    if (typeof sedexPrazo === 'string' && sedexPrazo.trim())
      dados.sedexPrazo = sedexPrazo.trim()
    if (typeof retiradaAtiva === 'boolean') dados.retiradaAtiva = retiradaAtiva
    if (typeof retiradaPrazo === 'string' && retiradaPrazo.trim())
      dados.retiradaPrazo = retiradaPrazo.trim()
    if (typeof retiradaEndereco === 'string' && retiradaEndereco.trim())
      dados.retiradaEndereco = retiradaEndereco.trim()

    const atualizado = await db.configuracaoFrete.update({
      where: { id: configAtual.id },
      data: dados,
    })

    return NextResponse.json({
      ...atualizado,
      createdAt: atualizado.createdAt.toISOString(),
      updatedAt: atualizado.updatedAt.toISOString(),
    })
  } catch (e) {
    console.error('frete/config PUT erro:', e)
    return NextResponse.json({ error: 'Erro ao atualizar configurações' }, { status: 500 })
  }
}
