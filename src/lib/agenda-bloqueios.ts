import { Prisma } from '@prisma/client'
const DURACAO_PADRAO_MINUTOS = 60

// Janela conservadora para agendamento sem duração explícita.
export function horarioFinal(inicio: Date): Date {
  return new Date(inicio.getTime() + DURACAO_PADRAO_MINUTOS * 60_000)
}
export async function validarBloqueioProfissional(
  tx: Prisma.TransactionClient, profissionalId: string | null | undefined,
  inicio: Date, fim: Date = horarioFinal(inicio), ignorarAgendamentoId?: string,
) {
  if (!profissionalId) return
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'profissional-agenda:' + profissionalId}))`
  const bloqueio = await tx.agendaBloqueio.findFirst({
    where:{ profissionalId, inicio:{lt:fim}, fim:{gt:inicio} },
    select:{id:true,tipo:true},
  })
  if (bloqueio) throw new Error('HORARIO_BLOQUEADO:' + bloqueio.tipo)
  const conflito = await tx.agendamento.findFirst({
    where:{ profissionalId, status:{in:['agendado','confirmado']},
      dataHora:{ gte:new Date(inicio.getTime()-DURACAO_PADRAO_MINUTOS*60_000),lt:fim },
      ...(ignorarAgendamentoId?{id:{not:ignorarAgendamentoId}}:{}) },
    select:{id:true},
  })
  if (conflito) throw new Error('PROFISSIONAL_OCUPADO')
}
export function mensagemAgenda(e: unknown) {
  if (!(e instanceof Error)) return null
  if (e.message.startsWith('HORARIO_BLOQUEADO:')) return 'Este profissional está indisponível: ' + e.message.split(':')[1] + '. Escolha outro horário.'
  if (e.message === 'PROFISSIONAL_OCUPADO') return 'O profissional já possui um atendimento próximo deste horário. Escolha outro horário.'
  return null
}
