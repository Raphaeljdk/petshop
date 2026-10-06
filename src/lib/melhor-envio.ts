import { randomBytes } from 'node:crypto'
import { request as httpsRequest } from 'node:https'
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

function limparTokenMelhorEnvio(value: string | undefined | null) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  // Aceita tanto o JWT puro quanto uma linha/bloco copiado da tela OAuth:
  // MELHOR_ENVIO_ACCESS_TOKEN="eyJ..."
  const quotedAssignment = raw.match(
    /MELHOR_ENVIO_ACCESS_TOKEN\s*=\s*["']([^"'\r\n]+)["']/i
  )
  const plainAssignment = raw.match(
    /MELHOR_ENVIO_ACCESS_TOKEN\s*=\s*([^\r\n]+)/i
  )

  let token = quotedAssignment?.[1] || plainAssignment?.[1] || raw
  token = token.trim().replace(/^Bearer\s+/i, '')
  token = token.replace(/^['"]+|['"]+$/g, '')
  return token.replace(/[\s\u2028\u2029\u0085]+/g, '')
}

function analisarTokenMelhorEnvio(token: string) {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return { jwt: false as const, expirado: false, expiraEm: null as string | null }
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    ) as { exp?: number }

    const exp = Number(payload.exp)
    const expirado = Number.isFinite(exp) && exp > 0
      ? exp * 1000 <= Date.now()
      : false

    return {
      jwt: true as const,
      expirado,
      expiraEm:
        Number.isFinite(exp) && exp > 0
          ? new Date(exp * 1000).toISOString()
          : null,
    }
  } catch {
    return { jwt: false as const, expirado: false, expiraEm: null as string | null }
  }
}

export function melhorEnvioOriginCep() {
  const envCep = (process.env.MELHOR_ENVIO_ORIGIN_CEP || '').replace(/\D/g, '')
  return envCep.length === 8 ? envCep : MATILHA_PRADO_ORIGIN_CEP
}

export function melhorEnvioConfigurado() {
  return Boolean(
    limparTokenMelhorEnvio(process.env.MELHOR_ENVIO_ACCESS_TOKEN) &&
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

type MelhorEnvioHttpResponse = {
  status: number
  body: string
  contentType: string
}

function requestMelhorEnvioHttps(
  url: string,
  token: string,
  body: string
): Promise<MelhorEnvioHttpResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const req = httpsRequest(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: 'POST',
        family: 4,
        servername: target.hostname,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent':
            process.env.MELHOR_ENVIO_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = []

        res.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })

        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf8'),
            contentType: String(res.headers['content-type'] || 'desconhecido'),
          })
        })
      }
    )

    req.setTimeout(15000, () => {
      const error = new Error('Melhor Envio HTTPS timeout')
      error.name = 'HTTPS_TIMEOUT'
      req.destroy(error)
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

export async function cotarMelhorEnvioComDiagnostico(
  cepDestino: string,
  pacote: MelhorEnvioPackage
): Promise<MelhorEnvioCotacaoResultado> {
  const token = limparTokenMelhorEnvio(process.env.MELHOR_ENVIO_ACCESS_TOKEN)
  const cepOrigem = melhorEnvioOriginCep()
  const destino = cepDestino.replace(/\D/g, '')

  if (!token || cepOrigem.length !== 8 || destino.length !== 8) {
    return {
      opcoes: [],
      status: 'nao_configurado',
      mensagem: 'Melhor Envio ainda não está completamente configurado.',
    }
  }

  const tokenInfo = analisarTokenMelhorEnvio(token)
  if (!tokenInfo.jwt) {
    return {
      opcoes: [],
      status: 'token_invalido',
      mensagem:
        'O valor salvo em MELHOR_ENVIO_ACCESS_TOKEN não é um access token JWT válido. Salve somente o valor do access_token, sem o nome da variável, refresh token ou outras linhas.',
    }
  }

  if (tokenInfo.expirado) {
    return {
      opcoes: [],
      status: 'token_invalido',
      mensagem: tokenInfo.expiraEm
        ? `O access token do Melhor Envio expirou em ${new Date(tokenInfo.expiraEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Reconecte a conta para gerar um novo token.`
        : 'O access token do Melhor Envio expirou. Reconecte a conta para gerar um novo token.',
    }
  }

  try {
    const requestBody = JSON.stringify({
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
    })

    const baseUrls = melhorEnvioUsaSandbox()
      ? [SANDBOX_URL]
      : [PROD_URL, 'https://www.melhorenvio.com.br']

    let response: MelhorEnvioHttpResponse | null = null
    let ultimoErroTransporte: unknown = null

    for (const baseUrl of baseUrls) {
      try {
        response = await requestMelhorEnvioHttps(
          `${baseUrl}/api/v2/me/shipment/calculate`,
          token,
          requestBody
        )
        break
      } catch (error) {
        ultimoErroTransporte = error
        console.error('Melhor Envio transporte HTTPS:', baseUrl, error)
      }
    }

    if (!response) {
      const causa =
        ultimoErroTransporte instanceof Error
          ? [ultimoErroTransporte.name, ultimoErroTransporte.message]
              .filter(Boolean)
              .join(': ')
          : 'erro_desconhecido'
      return {
        opcoes: [],
        status: 'erro',
        mensagem:
          `Falha de conexão HTTPS do servidor com o Melhor Envio (${causa.slice(0, 120)}).`,
      }
    }

    const rawBody = response.body

    if (response.status < 200 || response.status >= 300) {
      console.error(
        'Melhor Envio cotacao:',
        response.status,
        rawBody.slice(0, 500)
      )

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
            'O Melhor Envio recusou a chamada (HTTP 403). Confirme a permissão shipping-calculate; se a resposta for HTML, pode haver bloqueio de rede/WAF sobre a origem da requisição.',
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

    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
    } catch {
      const contentType = response.contentType || 'desconhecido'
      console.error(
        'Melhor Envio resposta não JSON:',
        response.status,
        contentType,
        rawBody.slice(0, 200)
      )
      return {
        opcoes: [],
        status: 'erro',
        mensagem:
          `O Melhor Envio respondeu HTTP ${response.status}, mas em formato inesperado (${contentType.split(';')[0]}). Isso normalmente indica bloqueio/intermediação da requisição antes da API.`,
        httpStatus: response.status,
      }
    }

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
    const nome = error instanceof Error ? error.name : 'erro_desconhecido'
    return {
      opcoes: [],
      status: 'erro',
      mensagem: `Falha inesperada ao consultar o Melhor Envio (${nome}).`,
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
