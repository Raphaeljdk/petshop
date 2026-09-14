// Executar apenas em um ambiente confiável, conectado ao banco da aplicação.
import { randomBytes, createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const emailIndex = process.argv.indexOf('--email')
const email = emailIndex >= 0 ? process.argv[emailIndex + 1]?.trim().toLowerCase() : undefined
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
  console.error('Uso: npm run admin:invite -- --email administrador@exemplo.com')
  process.exit(1)
}
const prisma = new PrismaClient()
try {
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new Error('Este e-mail já possui uma conta. Nenhuma permissão foi alterada.')
  }
  const code = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 48 * 60 * 60_000)
  await prisma.$transaction(async tx => {
    await tx.adminInvitation.updateMany({ where: { email, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } })
    await tx.adminInvitation.create({ data: { email, tokenHash: createHash('sha256').update(code).digest('hex'), expiresAt } })
  })
  console.log('Convite de administrador criado para: ' + email)
  console.log('Válido até: ' + expiresAt.toISOString())
  console.log('Abra /cadastro/administrador no site e informe o e-mail e o código abaixo:')
  console.log(code)
  console.log('O código é de uso único. Guarde-o em particular e não o envie ao GitHub.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Não foi possível criar o convite.')
  process.exitCode = 1
} finally { await prisma.$disconnect() }
