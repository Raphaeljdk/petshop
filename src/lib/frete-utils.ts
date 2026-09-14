/**
 * Utilitários puros de frete (CEP) — seguros para uso em client components.
 *
 * Funções que precisam de acesso a DB ficam em `@/lib/frete.ts` (server only).
 */

/** Normaliza o CEP removendo tudo que não for dígito. */
export function normalizarCep(cep: string): string {
  return (cep || '').replace(/\D/g, '').slice(0, 8)
}

/** Formata o CEP no padrão XXXXX-XXX. */
export function formatarCep(cep: string): string {
  const limpo = normalizarCep(cep)
  if (limpo.length <= 5) return limpo
  return `${limpo.slice(0, 5)}-${limpo.slice(5)}`
}

/** Valida o CEP informado (8 dígitos). */
export function validarCep(cep: string): boolean {
  const limpo = normalizarCep(cep)
  return limpo.length === 8
}

/** Aplica máscara enquanto o usuário digita. */
export function aplicarMascaraCep(valor: string): string {
  const limpo = valor.replace(/\D/g, '').slice(0, 8)
  if (limpo.length <= 5) return limpo
  return `${limpo.slice(0, 5)}-${limpo.slice(5)}`
}
