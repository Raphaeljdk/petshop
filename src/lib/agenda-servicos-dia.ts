import { z } from 'zod'

export function diaSaoPaulo(data: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(data)
  const p = (tipo: string) => partes.find(x => x.type === tipo)?.value
  return p('year') + '-' + p('month') + '-' + p('day')
}
export const diaAgendaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => {
  const dt = new Date(d + 'T12:00:00Z')
  return Number.isFinite(dt.getTime()) && dt.toISOString().slice(0, 10) === d
}, 'Data inválida.')

const servicoDiaSchema = z.object({
  chave: z.string().min(2).max(100),
  profissionais: z.array(z.string().min(1).max(100)).min(1).max(50),
}).strict()
export type ServicoDia = z.infer<typeof servicoDiaSchema>
export const servicosDiaSchema = z.array(servicoDiaSchema).max(150).superRefine((items, ctx) => {
  const chaves = new Set<string>()
  for (const [i, item] of items.entries()) {
    if (chaves.has(item.chave) || new Set(item.profissionais).size !== item.profissionais.length)
      ctx.addIssue({ code: 'custom', path: [i], message: 'Não repita serviços nem profissionais na escala.' })
    chaves.add(item.chave)
  }
})
export function lerServicosDia(valor: unknown): ServicoDia[] {
  const r = servicosDiaSchema.safeParse(valor)
  return r.success ? r.data : []
}
export function profissionaisDisponiveis(ids: string[], ativos: Set<string>, bloqueios: Array<{ profissionalId: string; inicio: Date; fim: Date }>, inicio: Date, fim: Date): string[] {
  return ids.filter(id => ativos.has(id) && !bloqueios.some(b => b.profissionalId === id && b.inicio < fim && b.fim > inicio))
}
