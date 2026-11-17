// O início do bloqueio é inclusivo; o fim é exclusivo.
export function horarioBloqueado(horario: Date, inicio: Date, fim: Date): boolean {
  return horario >= inicio && horario < fim
}
export function intervalosSobrepostos(inicioA: Date, fimA: Date, inicioB: Date, fimB: Date): boolean {
  return inicioA < fimB && fimA > inicioB
}
