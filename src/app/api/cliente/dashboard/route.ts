// GET /api/cliente/dashboard - dados agregados para a tela inicial do cliente
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const cliente = await getClienteLogado()
    if (!cliente) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar pets do cliente
    const pets = await db.pet.findMany({
      where: { clienteId: cliente.id },
      include: {
        processos: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    // Próximos agendamentos (futuros, não cancelados)
    const agora = new Date()
    const proximosAgendamentos = await db.agendamento.findMany({
      where: {
        clienteId: cliente.id,
        dataHora: { gte: agora },
        status: { in: ['agendado', 'confirmado'] },
      },
      include: { pet: { select: { id: true, nome: true, especie: true, fotoUrl: true } } },
      orderBy: { dataHora: 'asc' },
      take: 3,
    })

    // Últimas compras (vendas)
    const ultimasCompras = await db.venda.findMany({
      where: { clienteId: cliente.id },
      include: {
        itens: { include: { produto: { select: { nome: true, imageUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    })

    // Total gasto
    const todasVendas = await db.venda.findMany({
      where: { clienteId: cliente.id, status: { in: ['concluida', 'paga', 'enviada'] } },
      select: { total: true },
    })
    const totalGasto = todasVendas.reduce((acc, v) => acc + v.total, 0)

    // Processos ativos (em andamento)
    const petIds = pets.map((p) => p.id)
    const processosAtivos = await db.processo.count({
      where: { petId: { in: petIds }, status: { in: ['novo', 'em_andamento'] } },
    })

    // Produtos em destaque (4 produtos aleatórios ativos com estoque)
    const produtosDestaque = await db.produto.findMany({
      where: { ativo: true, estoque: { gt: 0 } },
      take: 4,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nome: true,
        preco: true,
        precoPromo: true,
        imageUrl: true,
        categoria: true,
      },
    })

    return NextResponse.json({
      cliente: {
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        cep: cliente.cep,
      },
      stats: {
        totalPets: pets.length,
        totalAgendamentos: proximosAgendamentos.length,
        totalCompras: todasVendas.length,
        totalGasto,
        processosAtivos,
      },
      pets: pets.map((p) => ({
        id: p.id,
        nome: p.nome,
        especie: p.especie,
        raca: p.raca,
        fotoUrl: p.fotoUrl,
        ultimoProcesso: p.processos[0]
          ? {
              status: p.processos[0].status,
              servico: p.processos[0].servico,
              createdAt: p.processos[0].createdAt,
            }
          : null,
      })),
      proximosAgendamentos,
      ultimasCompras: ultimasCompras.map((v) => ({
        id: v.id,
        total: v.total,
        status: v.status,
        createdAt: v.createdAt,
        itens: v.itens.map((i) => ({
          quantidade: i.quantidade,
          nome: i.produto?.nome || '',
          imageUrl: i.produto?.imageUrl,
        })),
      })),
      produtosDestaque,
    })
  } catch (e) {
    console.error('cliente dashboard erro:', e)
    return NextResponse.json({ error: 'Erro ao carregar dashboard' }, { status: 500 })
  }
}
