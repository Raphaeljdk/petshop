import { z } from 'zod'

export const emailSchema = z.string().trim().toLowerCase().max(254).email('Informe um e-mail válido.')
export const passwordRules = [
  { label: 'Pelo menos 10 caracteres', test: (value: string) => value.length >= 10 },
  { label: 'Uma letra e um número', test: (value: string) => /[a-zA-ZÀ-ÿ]/.test(value) && /\d/.test(value) },
  { label: 'No máximo 72 bytes', test: (value: string) => new TextEncoder().encode(value).length <= 72 },
]

const passwordSchema = z.string()
  .min(10, 'Use pelo menos 10 caracteres.')
  .max(72, 'A senha é muito longa.')
  .refine(value => new TextEncoder().encode(value).length <= 72, 'A senha deve ter no máximo 72 bytes.')
  .refine(value => /[a-zA-ZÀ-ÿ]/.test(value) && /\d/.test(value), 'Inclua uma letra e um número.')

const common = {
  nome: z.string().trim().min(3, 'Informe seu nome.').max(100, 'Use até 100 caracteres.'),
  email: emailSchema,
  senha: passwordSchema,
  confirmarSenha: z.string().min(1, 'Confirme sua senha.'),
}
const passwordsMatch = (data: { senha: string; confirmarSenha: string }) => data.senha === data.confirmarSenha
const confirmationError = { message: 'As senhas não coincidem.', path: ['confirmarSenha'] }

export const clientRegistrationSchema = z.object({
  ...common,
  role: z.literal('CLIENTE').optional(),
  telefone: z.string().max(25).transform(value => value.replace(/\D/g, ''))
    .refine(value => /^[1-9]{2}\d{8,9}$/.test(value), 'Informe o telefone com DDD (10 ou 11 números).'),
  cpfCnpj: z.string().max(18).transform(value => value.replace(/\D/g, ''))
    .refine(value => value.length === 11 || value.length === 14, 'Informe CPF ou CNPJ válido.'),
  endereco: z.string().trim().max(240, 'Use até 240 caracteres.').optional(),
  cep: z.string().max(10).transform(value => value.replace(/\D/g, ''))
    .refine(value => !value || value.length === 8, 'Informe os 8 números do CEP.').optional(),
}).strict().refine(passwordsMatch, confirmationError)

export const adminRegistrationSchema = z.object({
  ...common,
  role: z.literal('ADMIN').optional(),
  convite: z.string().trim().regex(/^[a-f0-9]{64}$/, 'Cole o código de convite completo.'),
}).strict().refine(passwordsMatch, confirmationError)

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, 'Informe sua senha.').max(256, 'Senha inválida.'),
  lembrar: z.boolean().optional().default(false),
}).strict()

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] || 'form')
    if (!result[key]) result[key] = issue.message
  }
  return result
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  const local = digits.slice(2)
  const split = local.length > 8 ? 5 : 4
  return '(' + digits.slice(0, 2) + ') ' + local.slice(0, split) + (local.length > split ? '-' + local.slice(split) : '')
}

export function formatCep(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}


export function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\/\d{4})(\d)/, '$1-$2')
}
