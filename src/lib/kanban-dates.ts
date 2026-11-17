/** Datas do calendário operacional: comparar em horário local, não em UTC. */
export function dataLocalIso(data: Date): string {
  if (Number.isNaN(data.getTime())) return ''
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** O cartão pertence ao dia de abertura do atendimento no Kanban. */
export function processoNoDia(criadoEm: string, dia: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false
  return dataLocalIso(new Date(criadoEm)) === dia
}
