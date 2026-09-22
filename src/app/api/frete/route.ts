import { NextRequest, NextResponse } from 'next/server'
import { calcularOpcoesFrete, formatarCep, validarCep } from '@/lib/frete'

export const dynamic = 'force-dynamic'

/**
 * GET /api/frete?cep=XXXXX-XXX
 *
 * Retorna as opções de entrega atualmente habilitadas para o CEP informado:
 *  - Retirada na loja
 *  - Motoboy Matilha Prado na faixa configurada da Zona Norte de São Paulo
 *
 * Correios/Sedex permanece desativado até a contratação e configuração
 * das credenciais oficiais do cliente.
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
