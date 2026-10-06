import { randomBytes } from 'node:crypto'
import type { OpcaoFrete } from '@/lib/types'

const PROD_URL = 'https://melhorenvio.com.br'
const SANDBOX_URL = 'https://sandbox.melhorenvio.com.br'
const MATILHA_PRADO_ORIGIN_CEP = '02333001'
const DEFAULT_USER_AGENT = 'Matilha Prado (matilhaprado@gmail.com)'
export const MELHOR_ENVIO_CALLBACK =
  'https://www.matilhaprado.com.br/api/integracoes/melhor-envio/callback'
export const MELHOR_ENVIO_COOKIE = 'melhor_envio_oauth_pending'
export const MELHOR_ENVIO_COOKIE_AGE = 600

type MelhorEnvioQuote = {
  id?: number
  name?: string
  price?: string
  custom_price?: string
  delivery_time?: number
  custom_delivery_time?: number
  error?: string
  company?: { name?: string }
}

export type MelhorEnvioPackage = {
  weight: number
  width: number
  height: number
  length: number
  insuranceValue?: number
  quantity?: number
}

export type MelhorEnvioCotacaoStatus =
  | 'ok'
  | 'nao_configurado'
  | 'token_invalido'
  | 'sem_permissao'
  | 'sem_servicos'
  | 'erro'

export type MelhorEnvioCotacaoResultado = {
  opcoes: OpcaoFrete[]
  status: MelhorEnvioCotacaoStatus
  mensagem: string
  httpStatus?: number
}

export function randomUrlSafe(bytes = 32) {
  return randomBytes(bytes).toString('base64url')
}

export function melhorEnvioOriginCep() {
  const envCep = (process.env.MELHOR_ENVIO_ORIGIN_CEP || '').replace(/\D/g, '')
  return envCep.length === 8 ? envCep : MATILHA_PRADO_ORIGIN_CEP
}

export function melhorEnvioConfigurado() {
  return Boolean(
    process.env.MELHOR_ENVIO_ACCESS_TOKEN?.trim() &&
      melhorEnvioOriginCep().length === 8
  )
}

export function melhorEnvioBaseUrl() {
  // Produção da Vercel nunca deve cotar no sandbox por causa de uma variável antiga.
  if (process.env.VERCEL_ENV === 'production') return PROD_URL
  return process.env.MELHOR_ENVIO_SANDBOX === 'true' ? SANDBOX_URL : PROD_URL
}

export function melhorEnvioUsaSandbox() {
  return melhorEnvioBaseUrl() === SANDBOX_URL
}

export function melhorEnvioOAuthConfig() {
  const clientId =
    process.env.MELHOR_ENVIO_CLIENT_ID?.trim() ||
    process.env.ID_DO_CLIENTE_DE_ENVIO_MELHOR?.trim()
  const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET?.trim()
  const redirectUri =
    process.env.MELHOR_ENVIO_REDIRECT_URI?.trim() || MELHOR_ENVIO_CALLBACK
  const scopes =
    process.env.MELHOR_ENVIO_SCOPES?.trim() || 'shipping-calculate'
  const userAgent =
    process.env.MELHOR_ENVIO_USER_AGENT?.trim() || DEFAULT_USER_AGENT

  if (!clientId || !clientSecret || redirectUri !== MELHOR_ENVIO_CALLBACK) {
    throw new Error('Configuração OAuth do Melhor Envio incompleta')
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes,
    userAgent,
    baseUrl: melhorEnvioBaseUrl(),
  }
}

export function melhorEnvioDefaultPackage(insuranceValue = 0): MelhorEnvioPackage {
  return {
    weight: numeroPositivo(process.env.MELHOR_ENVIO_DEFAULT_WEIGHT, 1),
    width: numeroPositivo(process.env.MELHOR_ENVIO_DEFAULT_WIDTH, 20),
    height: numeroPositivo(process.env.MELHOR_ENVIO_DEFAULT_HEIGHT, 10),
    length: numeroPositivo(process.env.MELHOR_ENVIO_DEFAULT_LENGTH, 30),
    insuranceValue,
  }
}

export function numeroPositivo(valor: string | number | null | undefined, fallback: number) {
  const n = Number(valor)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export async function cotarMelhorEnvioComDiagnostico(
  cepDestino: string,
  pacote: MelhorEnvioPackage
): Promise<MelhorEnvioCotacaoResultado> {
  const token = process.env.MELHOR_ENVIO_ACCESS_TOKEN?.trim()
  const cepOrigem = melhorEnvioOriginCep()
  const destino = cepDestino.replace(/\D/g, '')

  if (!token || cepOrigem.length !== 8 || destino.length !== 8) {
    return {
      opcoes: [],
      status: 'nao_configurado',
      mensagem: 'Melhor Envio ainda não está completamente configurado.',
    }
  }

  try {
    const response = await fetch(`${melhorEnvioBaseUrl()}/api/v2/me/shipment/calculate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent':
          process.env.MELHOR_ENVIO_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
      },
      body: JSON.stringify({
        from: { postal_code: cepOrigem },
        to: { postal_code: destino },
        package: {
          height: Math.max(1, pacote.height),
          width: Math.max(1, pacote.width),
          length: Math.max(1, pacote.length),
          weight: Math.max(0.01, pacote.weight),
        },
        options: {
          insurance_value: Math.max(0, pacote.insuranceValue || 0),
          receipt: false,
          own_hand: false,
        },
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const body = await response.text()
      console.error('Melhor Envio cotacao:', response.status, body.slice(0, 500))

      if (response.status === 401) {
        return {
          opcoes: [],
          status: 'token_invalido',
          mensagem:
            'O token do Melhor Envio foi recusado. Gere um novo token no mesmo ambiente usado pela loja (produção).',
          httpStatus: response.status,
        }
      }

      if (response.status === 403) {
        return {
          opcoes: [],
          status: 'sem_permissao',
          mensagem:
            'O Melhor Envio recusou a permissão de cotação. Confirme o acesso shipping-calculate e as transportadoras habilitadas no aplicativo.',
          httpStatus: response.status,
        }
      }

      return {
        opcoes: [],
        status: 'erro',
        mensagem: `Melhor Envio indisponível no momento (HTTP ${response.status}).`,
        httpStatus: response.status,
      }
    }

    const payload = (await response.json()) as unknown
    const quotes = Array.isArray(payload) ? (payload as MelhorEnvioQuote[]) : []

    const opcoes = quotes
      .filter((quote) => !quote.error && Number(quote.custom_price || quote.price) >= 0)
      .map((quote) => {
        const prazo = Number(quote.custom_delivery_time || quote.delivery_time || 0)
        const transportadora = quote.company?.name || 'Transportadora'
        const servico = quote.name || 'Entrega'
        return {
          tipo: 'melhor_envio' as const,
          label: `${transportadora} · ${servico}`,
          valor: Number(quote.custom_price || quote.price || 0),
          prazo:
            prazo > 0
              ? `${prazo} dia${prazo === 1 ? '' : 's'} útil${prazo === 1 ? '' : 'eis'}`
              : 'Prazo sob consulta',
          descricao: 'Frete calculado pelo Melhor Envio',
          disponivel: true,
          melhorEnvioServiceId: quote.id ? String(quote.id) : undefined,
        }
      })

    if (opcoes.length === 0) {
      const primeiroErro = quotes.find((quote) => quote.error)?.error?.trim()
      return {
        opcoes: [],
        status: 'sem_servicos',
        mensagem: primeiroErro
          ? `Nenhum serviço disponível. Melhor Envio: ${primeiroErro.slice(0, 180)}`
          : 'Nenhuma transportadora/serviço retornou cotação. Habilite os serviços do aplicativo no painel do Melhor Envio.',
      }
    }

    return {
      opcoes,
      status: 'ok',
      mensagem: `${opcoes.length} opção(ões) de frete encontrada(s).`,
    }
  } catch (error) {
    console.error('Melhor Envio cotacao indisponivel:', error)
    return {
      opcoes: [],
      status: 'erro',
      mensagem: 'Não foi possível consultar o Melhor Envio agora.',
    }
  }
}

export async function cotarMelhorEnvio(
  cepDestino: string,
  pacote: MelhorEnvioPackage
): Promise<OpcaoFrete[]> {
  const resultado = await cotarMelhorEnvioComDiagnostico(cepDestino, pacote)
  return resultado.opcoes
}
