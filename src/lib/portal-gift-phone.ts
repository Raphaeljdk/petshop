/**
 * Telefone brasileiro (DDD + 8 ou 9 dígitos), com DDI 55 opcional.
 * Armazena em formato de dígitos com DDI para comparar sem depender da máscara.
 */
export function normalizarTelefonePresente(valor: string): string | null {
  let digitos = valor.replace(/\D/g, '')
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    digitos = digitos.slice(2)
  }
  if (!/^\d{10,11}$/.test(digitos)) return null
  if (Number(digitos.slice(0, 2)) < 11) return null
  if (/^(\d)\1+$/.test(digitos)) return null
  return `55${digitos}`
}
