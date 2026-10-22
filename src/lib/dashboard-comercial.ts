const DIA_MS = 86_400_000

export function diaSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(data)
}

export function periodoComercial(dias: 7 | 30 | 90, agora: Date) {
  const hoje = diaSaoPaulo(agora)
  // Inclui o dia atual e os N-1 dias anteriores, desde a meia-noite de São Paulo.
  const calendario = new Date(hoje + 'T12:00:00Z')
  calendario.setUTCDate(calendario.getUTCDate() - dias + 1)
  const inicio = new Date(calendario.toISOString().slice(0, 10) + 'T00:00:00-03:00')
  const datas = Array.from({ length: dias }, (_, i) =>
    new Date(calendario.getTime() + i * DIA_MS).toISOString().slice(0, 10))
  return { inicio, fim: agora, datas }
}

export function proximosAniversarios(pets: Array<{
  id: string
  nome: string
  nascimento: Date | null
  cliente: { nome: string }
}>, agora: Date) {
  const hoje = diaSaoPaulo(agora)
  const [ano, mes, dia] = hoje.split('-').map(Number)
  const meiaNoiteUtc = Date.UTC(ano, mes - 1, dia)
  return pets.flatMap((pet) => {
    const nascimento = pet.nascimento
    if (!nascimento || !Number.isFinite(nascimento.getTime()) ||
      nascimento.toISOString().slice(0, 10) > hoje) return []
    const mesAniversario = nascimento.getUTCMonth()
    const diaAniversario = nascimento.getUTCDate()
    function ocorrencia(anoAlvo: number) {
      // Para nascidos em 29/02, considerar 28/02 nos anos não bissextos.
      const ultimoDia = new Date(Date.UTC(anoAlvo, mesAniversario + 1, 0)).getUTCDate()
      return Date.UTC(anoAlvo, mesAniversario, Math.min(diaAniversario, ultimoDia))
    }
    let anoProximo = ano
    let proximo = ocorrencia(anoProximo)
    if (proximo < meiaNoiteUtc) proximo = ocorrencia(++anoProximo)
    const dias = Math.round((proximo - meiaNoiteUtc) / DIA_MS)
    if (dias < 0 || dias > 30) return []
    return [{
      id: pet.id, nome: pet.nome, tutor: pet.cliente.nome,
      data: new Date(proximo).toISOString().slice(0, 10),
      dias, idade: anoProximo - nascimento.getUTCFullYear(),
    }]
  }).sort((a, b) => a.dias - b.dias || a.nome.localeCompare(b.nome, 'pt-BR'))
}

export const arredondarMoeda = (valor: number) => Math.round(valor * 100) / 100
