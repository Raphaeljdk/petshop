/// <reference types="bun-types" />
import { expect, test } from 'bun:test'
import { z } from 'zod'
import { clientRegistrationSchema } from '../src/lib/auth-validation'
import { composeRegistrationAddress, registrationAddressShape } from '../src/lib/registration-address'

const address = {
  cep: '01310-100',
  logradouro: ' Avenida Paulista ',
  numero: '1234',
  complemento: 'Conjunto 12',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'sp',
}
const googleRegistrationSchema = z.object({
  telefone: z.string().min(1),
  cpfCnpj: z.string().min(1),
  ...registrationAddressShape,
}).strict()
const client = {
  nome: 'Cliente de Teste', email: 'cliente@example.com',
  senha: 'SenhaForte123', confirmarSenha: 'SenhaForte123',
  telefone: '11999999999', cpfCnpj: '12345678909',
  ...address,
}

test('os cadastros tradicional e Google exigem CEP, logradouro, número, bairro, cidade e UF', () => {
  for (const key of ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'] as const) {
    const invalid = { ...address, [key]: '' }
    const normal = clientRegistrationSchema.safeParse({ ...client, [key]: '' })
    const google = googleRegistrationSchema.safeParse({ telefone: '11999999999', cpfCnpj: '12345678909', ...invalid })
    expect(normal.success).toBe(false)
    expect(google.success).toBe(false)
    if (!normal.success) expect(normal.error.issues.some(issue => issue.path[0] === key)).toBe(true)
    if (!google.success) expect(google.error.issues.some(issue => issue.path[0] === key)).toBe(true)
  }
})

test('formata CEP e UF no backend e mantém complemento opcional', () => {
  const normal = clientRegistrationSchema.safeParse(client)
  const google = googleRegistrationSchema.safeParse({ telefone: '11999999999', cpfCnpj: '12345678909', ...address })
  expect(normal.success).toBe(true)
  expect(google.success).toBe(true)
  if (!normal.success || !google.success) return
  expect(normal.data.cep).toBe('01310100')
  expect(google.data.uf).toBe('SP')
  expect(composeRegistrationAddress(normal.data)).toBe('Avenida Paulista, 1234 - Conjunto 12 - Bela Vista - São Paulo/SP')

  const withoutComplement = clientRegistrationSchema.safeParse({ ...client, complemento: undefined })
  expect(withoutComplement.success).toBe(true)
  if (withoutComplement.success) expect(withoutComplement.data.complemento).toBe('')
})

test('rejeita CEP inválido, UF inexistente e campos descritivos incompletos', () => {
  expect(googleRegistrationSchema.safeParse({ telefone: '1', cpfCnpj: '1', ...address, cep: '00000-000' }).success).toBe(false)
  expect(googleRegistrationSchema.safeParse({ telefone: '1', cpfCnpj: '1', ...address, uf: 'ZZ' }).success).toBe(false)
  expect(googleRegistrationSchema.safeParse({ telefone: '1', cpfCnpj: '1', ...address, logradouro: 'A' }).success).toBe(false)
})
