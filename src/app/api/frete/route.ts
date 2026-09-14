import { NextRequest, NextResponse } from 'next/server'
import { calcularOpcoesFrete, formatarCep, validarCep } from '@/lib/frete'

export const dynamic = 'force-dynamic'

/**
 * GET /api/frete?cep=XXXXX-XXX
 *
 * Retorna as opções de entrega disponíveis para o CEP informado:
 *  - Retirada na loja (sempre que ativa)
 *  - Entrega própria (apenas dentro da faixa de SP capital)
 *  - Sedex (qualquer CEP válido do Brasil, valor simulado)
 *
 * Se o CEP for inválido ou não informado, retorna apenas a opção de
 * retirada na loja (se ativa).
 */
export async function GET(req: NextRequest) {
  try {
    const cepParam = req.nextUrl.searchParams.get('cep') || ''
    const cepFormatado = formatarCep(cepParam)
    const valido = validarCep(cepParam)

    const { opcoes, dentroSP, config } = await calcularOpcoesFrete(cepParam)

    return NextResponse.json({
      cep: cepFormatado,
      valido,
      dentroSP,
      opcoes,
      retiradaEndereco: config.retiradaEndereco,
    })
  } catch (e) {
    console.error('frete GET erro:', e)
    return NextResponse.json({ error: 'Erro ao calcular frete' }, { status: 500 })
  }
}
