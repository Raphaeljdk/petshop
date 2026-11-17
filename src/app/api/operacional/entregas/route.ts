import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { canViewDeliveryAddresses } from '@/lib/operational-access'

export const dynamic = 'force-dynamic'

// Somente leitura. Não devolve totais, pagamentos, documentos ou itens da venda.
export async function GET() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!canViewDeliveryAddresses(user)) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  try {
    const vendas = await db.venda.findMany({
      where: {
        status: { not: 'cancelada' },
        tipoEntrega: { not: 'retirada' },
        OR: [{ statusEntrega: null }, { statusEntrega: { in: ['pendente', 'enviada'] } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, createdAt: true, tipoEntrega: true, statusEntrega: true,
        enderecoEntrega: true, cepEntrega: true,
        cliente: { select: { nome: true, telefone: true, endereco: true, cep: true } },
      },
    })
    const items = vendas.map(v => ({
      id: v.id, createdAt: v.createdAt,
      tipoEntrega: v.tipoEntrega, statusEntrega: v.statusEntrega || 'pendente',
      nomeCliente: v.cliente?.nome || 'Cliente não identificado',
      telefoneCliente: v.cliente?.telefone || null,
      enderecoEntrega: v.enderecoEntrega?.trim() || null,
      cepEntrega: v.cepEntrega || null,
      // Se faltar endereço do pedido, sinaliza explicitamente o endereço cadastral,
      // que pode não coincidir com o destino de entrega.
      enderecoCadastrado: v.enderecoEntrega?.trim() ? null : (v.cliente?.endereco || null),
      cepCadastrado: v.enderecoEntrega?.trim() ? null : (v.cliente?.cep || null),
    }))
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[operacional/entregas] falha:', error)
    return NextResponse.json({ error: 'Não foi possível carregar os endereços.' }, { status: 500 })
  }
}
