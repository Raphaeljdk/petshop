import { db } from '@/lib/db'
import { invitationMailConfig } from '@/lib/client-invitations'

export async function notifyRestockSubscribers() {
  const config = invitationMailConfig()
  if (!config.configured) {
    return {
      configured: false,
      sent: 0,
      pending: await db.customerPreference.count({
        where: {
          restock: true,
          produto: { ativo: true, estoque: { gt: 0 } },
        },
      }),
      errors: [] as string[],
    }
  }

  const subscriptions = await db.customerPreference.findMany({
    where: {
      restock: true,
      produto: { ativo: true, estoque: { gt: 0 } },
    },
    include: {
      cliente: { select: { nome: true, email: true } },
      produto: { select: { nome: true } },
    },
    orderBy: { updatedAt: 'asc' },
    take: 100,
  })

  let sent = 0
  const errors: string[] = []

  for (const subscription of subscriptions) {
    const email = subscription.cliente.email?.trim()
    if (!email) {
      errors.push(`${subscription.produto.nome}: cliente sem e-mail cadastrado.`)
      continue
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `restock-${subscription.id}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: [email],
        subject: `${subscription.produto.nome} voltou ao estoque`,
        text:
          `Olá, ${subscription.cliente.nome}!\n\n` +
          `O item "${subscription.produto.nome}" que você pediu para acompanhar voltou ao estoque da Matilha Prado.\n\n` +
          `Acesse ${config.origin} para conferir a disponibilidade atual.\n\n` +
          'Este aviso é enviado uma vez por solicitação.',
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      errors.push(
        `${subscription.produto.nome}: provedor de e-mail respondeu HTTP ${response.status}.`
      )
      continue
    }

    await db.customerPreference.update({
      where: { id: subscription.id },
      data: { restock: false },
    })
    sent += 1
  }

  return {
    configured: true,
    sent,
    pending: Math.max(0, subscriptions.length - sent),
    errors: errors.slice(0, 20),
  }
}
