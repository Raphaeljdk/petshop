import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  if (process.env.VERCEL_ENV !== 'production') {
    console.log('Bootstrap do Kanban ignorado fora de produção.')
    return
  }

  const email = process.env.KANBAN_LOGIN_EMAIL?.trim().toLowerCase()
  const passwordHash = process.env.KANBAN_LOGIN_PASSWORD_HASH?.trim() || ''

  if (!email || !passwordHash) {
    console.log('Bootstrap do Kanban ignorado: credenciais não configuradas.')
    return
  }

  if (!/^\$2[aby]\$\d{2}\$/.test(passwordHash)) {
    throw new Error('KANBAN_LOGIN_PASSWORD_HASH precisa ser um hash bcrypt válido.')
  }

  await prisma.user.upsert({
    where: { email },
    create: {
      nome: 'Agenda Matilha Prado',
      email,
      senha: passwordHash,
      role: 'KANBAN',
      ativo: true,
    },
    update: {
      nome: 'Agenda Matilha Prado',
      senha: passwordHash,
      role: 'KANBAN',
      ativo: true,
      clienteId: null,
      siggmaCliCod: null,
    },
  })

  console.log('Conta restrita do Kanban sincronizada.')
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
