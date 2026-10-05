import { NextRequest, NextResponse } from 'next/server'
import {
  calcularOpcoesFrete,
  formatarCep,
  HORARIO_FUNCIONAMENTO_LABEL,
  validarCep,
} from '@/lib/frete'
import {
  cotarMelhorEnvio,
  melhorEnvioConfigurado,
  melhorEnvioDefaultPackage,
  numeroPositivo,
} from '@/lib/melhor-envio'

export const dynamic = 'force-dynamic'

/**
 * GET /api/frete?cep=XXXXX-XXX&weight=1&width=20&height=10&length=30&insuranceValue=100
 *
 * Sempre preserva:
 *  - Retirada na loja
 *  - Motoboy Matilha Prado na faixa configurada da Zona Norte de São Paulo
 *
 * Quando MELHOR_ENVIO_ACCESS_TOKEN + MELHOR_ENVIO_ORIGIN_CEP estiverem configurados,
 * acrescenta as cotações reais retornadas pelo Melhor Envio.
 */
export async function GET(req: NextRequest) {
  try {
    const cepParam = req.nextUrl.searchParams.get('cep') || ''
    const cepFormatado = formatarCep(cepParam)
    const valido = validarCep(cepParam)

    const { opcoes, dentroSP, config } = await calcularOpcoesFrete(cepParam)
    const configurado = melhorEnvioConfigurado()
    let melhorEnvioOpcoes = [] as Awaited<ReturnType<typeof cotarMelhorEnvio>>

    if (valido && configurado) {
      melhorEnvioOpcoes = await cotarMelhorEnvio(cepParam, {
        weight: numeroPositivo(
          req.nextUrl.searchParams.get('weight'),
          melhorEnvioDefaultPackage().weight
        ),
        width: numeroPositivo(
          req.nextUrl.searchParams.get('width'),
          melhorEnvioDefaultPackage().width
        ),
        height: numeroPositivo(
          req.nextUrl.searchParams.get('height'),
          melhorEnvioDefaultPackage().height
        ),
        length: numeroPositivo(
          req.nextUrl.searchParams.get('length'),
          melhorEnvioDefaultPackage().length
        ),
        insuranceValue: numeroPositivo(
          req.nextUrl.searchParams.get('insuranceValue'),
          0
        ),
      })
    }

    return NextResponse.json({
      cep: cepFormatado,
      valido,
      dentroSP,
      opcoes: [...opcoes, ...melhorEnvioOpcoes],
      retiradaEndereco: config.retiradaEndereco,
      horarioFuncionamento: HORARIO_FUNCIONAMENTO_LABEL,
      correiosDisponivel: false,
      correiosMensagem:
        'Correios temporariamente indisponível. PAC/SEDEX permanecem desativados até nova liberação.',
      melhorEnvio: {
        configurado,
        ambiente: process.env.MELHOR_ENVIO_SANDBOX === 'true' ? 'sandbox' : 'producao',
        quantidadeOpcoes: melhorEnvioOpcoes.length,
      },
    })
  } catch (e) {
    console.error('frete GET erro:', e)
    return NextResponse.json({ error: 'Erro ao calcular frete' }, { status: 500 })
  }
}
