import { db } from '@/lib/db'
import { ANDRE_OPERATIONS_EMAIL, isOperationalOperator } from '@/lib/operational-access'

type User = { id: string; nome: string; email: string; role: string }

// Um perfil de agenda por pessoa; jamais confundir o bloqueio de um operador com o de outro.
export async function getOperationalProfessional(user: User) {
  if (!isOperationalOperator(user)) return null
  const existing = await db.profissionalAgenda.findUnique({ where: { userId: user.id } })
  if (existing) return existing
  const nome = user.email.trim().toLowerCase() === ANDRE_OPERATIONS_EMAIL ? 'André' : 'Aleksander'
  // Reaproveita um profissional já cadastrado com esse nome, sem assumir registros vinculados a outros logins.
  const available = await db.profissionalAgenda.findFirst({
    where: { nome: { equals: nome, mode: 'insensitive' }, userId: null, ativo: true },
    orderBy: { createdAt: 'asc' },
  })
  if (available) {
    const linked = await db.profissionalAgenda.updateMany({
      where: { id: available.id, userId: null },
      data: { userId: user.id },
    })
    if (linked.count) return db.profissionalAgenda.findUniqueOrThrow({ where: { userId: user.id } })
  }
  return db.profissionalAgenda.upsert({
    where: { userId: user.id }, update: {},
    create: { userId: user.id, nome, especialidades: 'Banho', ativo: true },
  })
}
