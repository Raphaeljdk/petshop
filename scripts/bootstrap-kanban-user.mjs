import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  if (process.env.VERCEL_ENV !== 'production') {
    console.log('Bootstrap do Kanban ignorado fora de produção.')
    return
  }

  const email = process.env.KANBAN_LOGIN_EMAIL?.trim().toLowerCase()
  const password = process.env.KANBAN_LOGIN_PASSWORD || ''

  if (!email || !password) {
    console.log('Bootstrap do Kanban ignorado: credenciais não configuradas.')
    return
  }

  if (Buffer.byteLength(password, 'utf8') > 72 || password.length < 10) {
    throw new Error('KANBAN_LOGIN_PASSWORD deve ter entre 10 e 72 bytes.')
  }

  const senha = await bcrypt.hash(password, 12)

  await prisma.user.upsert({
    where: { email },
    create: {
      nome: 'Agenda Matilha Prado',
      email,
      senha,
      role: 'KANBAN',
      ativo: true,
    },
    update: {
      nome: 'Agenda Matilha Prado',
      senha,
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
