import { z } from 'zod'
import { chaveRaca } from './precos-por-raca'

export const GRUPOS_PORTE = [
  { chave: 'mini', nome: 'Mini' },
  { chave: 'pequeno', nome: 'Pequeno' },
  { chave: 'medio', nome: 'Médio' },
  { chave: 'grande', nome: 'Grande' },
  { chave: 'extra-grande', nome: 'Extra grande' },
] as const

const grupoSchema = z.object({
  porte: z.enum(['mini', 'pequeno', 'medio', 'grande', 'extra-grande']),
  racas: z.array(z.string().trim().min(2).max(80)).max(100),
  precoCentavos: z.number().int().min(0).max(10_000_000).nullable(),
  duracaoMinutos: z.number().int().min(5).max(720).nullable(),
}).strict()

export type GrupoPorte = z.infer<typeof grupoSchema>

export const gruposPorteSchema = z.array(grupoSchema).length(5).superRefine((grupos, ctx) => {
  const portes = new Set<string>()
  const racas = new Set<string>()
  for (const [i, grupo] of grupos.entries()) {
    if (portes.has(grupo.porte)) ctx.addIssue({ code: 'custom', path: [i, 'porte'], message: 'Cada porte deve aparecer uma única vez.' })
    portes.add(grupo.porte)
    for (const [j, raca] of grupo.racas.entries()) {
      const chave = chaveRaca(raca)
      if (racas.has(chave)) ctx.addIssue({ code: 'custom', path: [i, 'racas', j], message: 'A raça ' + raca + ' está repetida neste serviço.' })
      racas.add(chave)
    }
  }
})

export function gruposPorteVazios(): GrupoPorte[] {
  return GRUPOS_PORTE.map(({ chave }) => ({ porte: chave, racas: [], precoCentavos: null, duracaoMinutos: null }))
}

export function lerGruposPorte(valor: unknown): GrupoPorte[] {
  const resultado = gruposPorteSchema.safeParse(valor)
  if (!resultado.success) return gruposPorteVazios()
  return GRUPOS_PORTE.map(({ chave }) => resultado.data.find(g => g.porte === chave)!)
}

export function gruposPorteConfirmaveis(valor: unknown): boolean {
  const resultado = gruposPorteSchema.safeParse(valor)
  if (!resultado.success) return false
  const ocupados = resultado.data.filter(g => g.racas.length > 0)
  return ocupados.length > 0 && ocupados.every(g => g.precoCentavos !== null && g.duracaoMinutos !== null)
}

export function grupoParaRaca(valor: unknown, raca: string | null | undefined): GrupoPorte | null {
  if (!raca?.trim()) return null
  const chave = chaveRaca(raca)
  const grupo = lerGruposPorte(valor).find(g => g.racas.some(r => chaveRaca(r) === chave))
  return grupo && grupo.precoCentavos !== null && grupo.duracaoMinutos !== null ? grupo : null
}
