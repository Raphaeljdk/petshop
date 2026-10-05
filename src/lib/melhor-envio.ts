import type { OpcaoFrete } from '@/lib/types'

const PROD_URL = 'https://melhorenvio.com.br'
const SANDBOX_URL = 'https://sandbox.melhorenvio.com.br'

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

export function melhorEnvioConfigurado() {
  return Boolean(process.env.MELHOR_ENVIO_ACCESS_TOKEN && process.env.MELHOR_ENVIO_ORIGIN_CEP)
}

function baseUrl() {
  return process.env.MELHOR_ENVIO_SANDBOX === 'true' ? SANDBOX_URL : PROD_URL
}

export async function cotarMelhorEnvio(
  cepDestino: string,
  pacote: MelhorEnvioPackage
): Promise<OpcaoFrete[]> {
  const token = process.env.MELHOR_ENVIO_ACCESS_TOKEN
  const cepOrigem = (process.env.MELHOR_ENVIO_ORIGIN_CEP || '').replace(/\D/g, '')
  const destino = cepDestino.replace(/\D/g, '')

  if (!token || cepOrigem.length !== 8 || destino.length !== 8) return []

  const response = await fetch(`${baseUrl()}/api/v2/me/shipment/calculate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': process.env.MELHOR_ENVIO_USER_AGENT || 'Matilha Prado (www.matilhaprado.com.br)',
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
    return []
  }

  const quotes = (await response.json()) as MelhorEnvioQuote[]

  return quotes
    .filter((quote) => !quote.error && Number(quote.custom_price || quote.price) >= 0)
    .map((quote) => {
      const prazo = Number(quote.custom_delivery_time || quote.delivery_time || 0)
      const transportadora = quote.company?.name || 'Transportadora'
      const servico = quote.name || 'Entrega'
      return {
        tipo: 'melhor_envio',
        label: `${transportadora} · ${servico}`,
        valor: Number(quote.custom_price || quote.price || 0),
        prazo: prazo > 0 ? `${prazo} dia${prazo === 1 ? '' : 's'} útil${prazo === 1 ? '' : 'eis'}` : 'Prazo sob consulta',
        descricao: 'Frete calculado pelo Melhor Envio',
        disponivel: true,
        melhorEnvioServiceId: quote.id ? String(quote.id) : undefined,
      }
    })
}
