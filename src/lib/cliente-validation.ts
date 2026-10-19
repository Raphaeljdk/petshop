import { z } from 'zod'

const optionalText = (max: number) => z.union([z.string().trim().max(max), z.null()]).optional()
export const clienteInputSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do cliente.').max(120),
  telefone: z.string().trim().min(8, 'Telefone inválido.').max(30).refine((value) => value.replace(/\D/g, '').length >= 10, 'Informe um telefone com DDD.'),
  email: optionalText(150),
  cpfCnpj: optionalText(24),
  endereco: optionalText(250),
  cep: optionalText(12),
}).strict().transform((value) => ({
  nome: value.nome,
  telefone: value.telefone,
  email: value.email?.trim().toLowerCase() || null,
  cpfCnpj: value.cpfCnpj?.replace(/\D/g, '') || null,
  endereco: value.endereco?.trim() || null,
  cep: value.cep?.replace(/\D/g, '') || null,
})).refine((value) => !value.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email), {
  path: ['email'], message: 'E-mail inválido.',
}).refine((value) => !value.cpfCnpj || [11, 14].includes(value.cpfCnpj.length), {
  path: ['cpfCnpj'], message: 'CPF/CNPJ deve ter 11 ou 14 dígitos.',
}).refine((value) => !value.cep || value.cep.length === 8, {
  path: ['cep'], message: 'CEP deve conter 8 dígitos.',
})

export function clienteValidationError(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message || 'Dados inválidos.'
  return null
}
