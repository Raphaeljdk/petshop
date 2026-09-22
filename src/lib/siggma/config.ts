export const SIGGMA_HOMOLOGATION_URL = 'https://virtuais.zettabrasil.com.br/siggma-3860testesapi'
export const SIGGMA_PRODUCTION_URL = 'https://sistema.zettabrasil.com.br/siggma'

export type SiggmaConfig = {
  baseUrl: string
  clientId: string
  clientSecret: string
  emp: string
}

export type SiggmaSchedulingConfig = SiggmaConfig & {
  expedienteId: number
}

export class SiggmaConfigurationError extends Error {
  constructor(public missing: string[]) {
    super(`Configuração Siggma incompleta: ${missing.join(', ')}`)
    this.name = 'SiggmaConfigurationError'
  }
}

export function getSiggmaConfigurationStatus() {
  const clientId = process.env.SIGGMA_CLIENT_ID?.trim() || ''
  const clientSecret = process.env.SIGGMA_CLIENT_SECRET?.trim() || ''
  const emp = process.env.SIGGMA_EMP?.trim() || ''
  const baseUrl = (process.env.SIGGMA_BASE_URL?.trim() || SIGGMA_HOMOLOGATION_URL).replace(/\/+$/, '')

  const missing: string[] = []
  if (!clientId) missing.push('SIGGMA_CLIENT_ID')
  if (!clientSecret) missing.push('SIGGMA_CLIENT_SECRET')
  if (!emp) missing.push('SIGGMA_EMP')

  return {
    configured: missing.length === 0,
    missing,
    baseUrl,
    environment: baseUrl === SIGGMA_PRODUCTION_URL ? 'production' : 'homologation',
    clientIdConfigured: Boolean(clientId),
    clientSecretConfigured: Boolean(clientSecret),
    empConfigured: Boolean(emp),
  } as const
}

export function getSiggmaConfig(): SiggmaConfig {
  const status = getSiggmaConfigurationStatus()
  if (!status.configured) throw new SiggmaConfigurationError([...status.missing])

  return {
    baseUrl: status.baseUrl,
    clientId: process.env.SIGGMA_CLIENT_ID!.trim(),
    clientSecret: process.env.SIGGMA_CLIENT_SECRET!.trim(),
    emp: process.env.SIGGMA_EMP!.trim(),
  }
}

export function getSiggmaSchedulingConfig(): SiggmaSchedulingConfig {
  const config = getSiggmaConfig()
  const rawExpediente = process.env.SIGGMA_EXPEDIENTE_ID?.trim() || ''
  const expedienteId = Number.parseInt(rawExpediente, 10)

  if (!rawExpediente || !Number.isFinite(expedienteId) || expedienteId < 1) {
    throw new SiggmaConfigurationError(['SIGGMA_EXPEDIENTE_ID'])
  }

  return { ...config, expedienteId }
}
