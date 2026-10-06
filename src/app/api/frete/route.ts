import { NextRequest, NextResponse } from 'next/server'
import {
  calcularOpcoesFrete,
  formatarCep,
  HORARIO_FUNCIONAMENTO_LABEL,
  validarCep,
} from '@/lib/frete'
import {
  cotarMelhorEnvioComDiagnostico,
  melhorEnvioConfigurado,
  melhorEnvioDefaultPackage,
  melhorEnvioUsaSandbox,
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
    let melhorEnvioResultado = {
      opcoes: [],
      status: configurado ? 'sem_servicos' : 'nao_configurado',
      mensagem: configurado
        ? 'Nenhuma cotação consultada ainda.'
        : 'Melhor Envio ainda não está completamente configurado.',
    } as Awaited<ReturnType<typeof cotarMelhorEnvioComDiagnostico>>

    if (valido && configurado) {
      melhorEnvioResultado = await cotarMelhorEnvioComDiagnostico(cepParam, {
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
      opcoes: [...opcoes, ...melhorEnvioResultado.opcoes],
      retiradaEndereco: config.retiradaEndereco,
      horarioFuncionamento: HORARIO_FUNCIONAMENTO_LABEL,
      correiosDisponivel: false,
      correiosMensagem:
        'Integração direta dos Correios temporariamente indisponível. Serviços oferecidos via Melhor Envio aparecem normalmente abaixo.',
      melhorEnvio: {
        configurado,
        ambiente: melhorEnvioUsaSandbox() ? 'sandbox' : 'producao',
        quantidadeOpcoes: melhorEnvioResultado.opcoes.length,
        status: melhorEnvioResultado.status,
        mensagem: melhorEnvioResultado.mensagem,
        httpStatus: melhorEnvioResultado.httpStatus ?? null,
      },
    })
  } catch (e) {
    console.error('frete GET erro:', e)
    return NextResponse.json({ error: 'Erro ao calcular frete' }, { status: 500 })
  }
}
