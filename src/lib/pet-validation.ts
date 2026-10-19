import { z } from 'zod'
const optionalText = (n: number) => z.union([z.string().trim().max(n), z.null()]).optional()
export const petInputSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do pet.').max(100),
  especie: z.string().trim().min(1, 'Informe a espécie.').max(70),
  raca: optionalText(100),
  porte: optionalText(30),
  sexo: optionalText(25),
  nascimento: z.union([z.string().trim().max(10), z.null()]).optional(),
  cor: optionalText(65),
  castrado: z.boolean().nullable().optional(),
  idade: optionalText(50),
  peso: optionalText(50),
  observacoes: optionalText(1000),
}).strict().transform(v => ({
  nome: v.nome, especie: v.especie,
  raca: v.raca || null,
  porte: v.porte || null,
  sexo: v.sexo || null,
  nascimento: v.nascimento && /^\d{4}-\d{2}-\d{2}$/.test(v.nascimento) ? new Date(v.nascimento + 'T12:00:00.000Z') : null,
  cor: v.cor || null,
  castrado: v.castrado ?? null,
  idade: v.idade || null,
  peso: v.peso || null,
  observacoes: v.observacoes || null,
})).refine(v => !v.nascimento || !Number.isNaN(v.nascimento.getTime()), {
  path: ['nascimento'], message: 'Data de nascimento inválida.',
})
export const clienteComPetsSchema = z.object({
  nome: z.string().min(1),
  telefone: z.string().min(1),
  email: z.string().nullable().optional(),
  cpfCnpj: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  pets: z.array(petInputSchema).max(20, 'Máximo de 20 pets por cadastro.').default([]),
}).strict()
