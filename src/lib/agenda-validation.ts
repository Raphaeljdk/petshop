import { CATEGORIAS_AGENDA } from '@/lib/agenda-servicos'
import { z } from 'zod'
export const statusAgenda = z.enum(['agendado', 'confirmado', 'concluido', 'cancelado'])
export const agendamentoSchema = z.object({
  clienteId: z.string().min(1),
  petId: z.string().min(1),
  servico: z.string().trim().min(2).max(140),
  categoria: z.enum(CATEGORIAS_AGENDA).optional(),
  dataHora: z.string().datetime({ offset: true }),
  observacoes: z.string().trim().max(1500).nullish(),
  profissionalId: z.string().min(1).nullish(),
}).strict()
export const agendamentoPatchSchema = z.object({
  clienteId: z.string().min(1).optional(),
  petId: z.string().min(1).optional(),
  servico: z.string().trim().min(2).max(140).optional(),
  categoria: z.enum(CATEGORIAS_AGENDA).optional(),
  dataHora: z.string().datetime({ offset: true }).optional(),
  observacoes: z.string().trim().max(1500).nullish(),
  status: statusAgenda.optional(),
  profissionalId: z.string().min(1).nullish(),
}).strict()
