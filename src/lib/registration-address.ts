import { z } from 'zod'

// Validação compartilhada: os dois fluxos de cadastro exigem o MESMO endereço.
const requiredText = (label: string, min: number, max: number) =>
  z.string().trim().min(min, 'Informe ' + label + '.').max(max, 'Use até ' + max + ' caracteres.')

export const BRAZILIAN_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export const registrationAddressShape = {
  cep: z.string().max(10).transform(value => value.replace(/\D/g, ''))
    .refine(value => /^\d{8}$/.test(value) && value !== '00000000', 'Informe um CEP válido com 8 números.'),
  logradouro: requiredText('a rua ou avenida', 3, 110),
  numero: requiredText('o número (ou S/N)', 1, 20),
  complemento: z.string().trim().max(70, 'Use até 70 caracteres.').optional().default(''),
  bairro: requiredText('o bairro', 2, 80),
  cidade: requiredText('a cidade', 2, 80),
  uf: z.string().trim().toUpperCase()
    .refine(value => (BRAZILIAN_UFS as readonly string[]).includes(value), 'Selecione um estado válido.'),
}

export type RegistrationAddressValues = {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

export const EMPTY_REGISTRATION_ADDRESS: RegistrationAddressValues = {
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
}

// Cliente.endereco continua em texto para preservar os cadastros existentes,
// frete, checkout e integrações. CEP permanece na coluna Cliente.cep.
export function composeRegistrationAddress(input: Omit<RegistrationAddressValues, 'cep'>): string {
  return [
    input.logradouro.trim() + ', ' + input.numero.trim(),
    input.complemento.trim() || null,
    input.bairro.trim(),
    input.cidade.trim() + '/' + input.uf.trim().toUpperCase(),
  ].filter(Boolean).join(' - ')
}
