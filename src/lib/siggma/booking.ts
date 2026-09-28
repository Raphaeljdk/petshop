export type SiggmaBookingService = {
  id: number
  nome: string
}

function readServices(): SiggmaBookingService[] {
  const raw = process.env.SIGGMA_AGENDAMENTO_SERVICOS_JSON?.trim()
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const unique = new Map<number, SiggmaBookingService>()
    for (const item of parsed) {
      const id = Number(item?.id)
      const nome = typeof item?.nome === 'string' ? item.nome.trim() : ''
      if (Number.isInteger(id) && id > 0 && nome) unique.set(id, { id, nome })
    }
    return [...unique.values()]
  } catch {
    return []
  }
}

export function getSiggmaBookingConfig() {
  const directEnabled =
    process.env.SIGGMA_AGENDAMENTO_DIRETO_ENABLED?.trim().toLowerCase() === 'true'
  const parsedExpediente = Number(
    process.env.SIGGMA_AGENDAMENTO_EXPEDIENTE_ID?.trim() || ''
  )
  const expedienteId =
    Number.isInteger(parsedExpediente) && parsedExpediente > 0
      ? parsedExpediente
      : null
  const services = readServices()
  const missing: string[] = []

  if (!directEnabled) missing.push('SIGGMA_AGENDAMENTO_DIRETO_ENABLED')
  if (!expedienteId) missing.push('SIGGMA_AGENDAMENTO_EXPEDIENTE_ID')
  if (!services.length) missing.push('SIGGMA_AGENDAMENTO_SERVICOS_JSON')

  return {
    directEnabled,
    expedienteId,
    services,
    writeConfigured: Boolean(directEnabled && expedienteId),
    configured: Boolean(directEnabled && expedienteId && services.length),
    missing,
  }
}
