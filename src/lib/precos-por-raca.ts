import { z } from 'zod'

export const LIMITE_PRECOS_POR_RACA = 80

export const precoPorRacaSchema = z.object({
  raca: z.string().trim().min(2, 'Informe o nome da raça (ao menos 2 letras).').max(80),
  precoCentavos: z.number().int().min(0).max(10_000_000),
}).strict()

export type PrecoPorRaca = z.infer<typeof precoPorRacaSchema>

export function chaveRaca(raca: string): string {
  return raca.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
}

export const precosPorRacaSchema = z.array(precoPorRacaSchema)
  .max(LIMITE_PRECOS_POR_RACA, `Cadastre no máximo ${LIMITE_PRECOS_POR_RACA} raças por serviço.`)
  .superRefine((valores, ctx) => {
    const vistos = new Set<string>()
    for (let i = 0; i < valores.length; i++) {
      const chave = chaveRaca(valores[i].raca)
      if (vistos.has(chave)) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'raca'],
          message: `A raça "${valores[i].raca}" já está cadastrada neste serviço.`,
        })
      }
      vistos.add(chave)
    }
  })

/** Dados históricos podem não ter o novo campo. Falha fechada sem inventar valores. */
export function lerPrecosPorRaca(valor: unknown): PrecoPorRaca[] {
  const resultado = precosPorRacaSchema.safeParse(valor)
  return resultado.success ? resultado.data : []
}
