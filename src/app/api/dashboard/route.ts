import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import type { DashboardStats } from '@/lib/types'

const NOMES_MESES_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

// Normaliza o canal de venda para um dos 3 canais padrão do dashboard.
function normalizarCanal(canal: string): 'loja' | 'mercadolivre' | 'amazon' {
  const c = (canal || '').toLowerCase()
  if (c.includes('amazon')) return 'amazon'
  if (c.includes('mercado') || c === 'ml' || c.includes('mercadolivre')) return 'mercadolivre'
  return 'loja' // 'loja' e 'site' entram no canal "loja"
}

// Normaliza o status do processo em 3 buckets para o gráfico.
function normalizarStatusProcesso(status: string): 'novo' | 'andamento' | 'finalizado' {
  const s = (status || '').toLowerCase()
  if (s === 'finalizado') return 'finalizado'
  if (s === 'novo') return 'novo'
  // em_andamento, aguardando_resposta, andamento, cancelado
  return 'andamento'
}

// Normaliza serviços de agendamento em buckets canônicos (mantém serviço livre-texto se não casar).
function normalizarServicoAgendamento(servico: string): string {
  const s = (servico || '').toLowerCase().replace(/\s+/g, '_')
  if (s.includes('banho') && s.includes('tosa')) return 'banho_e_tosa'
  if (s.includes('banho')) return 'banho'
  if (s.includes('tosa')) return 'tosa'
  if (s.includes('consulta') || s.includes('veterinario') || s.includes('veterinária')) return 'consulta'
  if (s.includes('vacina') || s.includes('vacinação')) return 'vacina'
  return servico || 'outro'
}

export async function GET() {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const hoje = new Date()
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)

    // Janela de 6 meses (incluindo o atual): do primeiro dia do mês 5 atrás até o primeiro dia do próximo mês.
    const inicio6Meses = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1)
    const fimJanela6Meses = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)

    // Status que contam como venda realizada (não cancelada)
    const statusVendaValidos = ['concluida', 'paga', 'enviada', 'pendente']

    const [
      totalClientes,
      totalPets,
      totalProdutos,
      totalVendas,
      totalAgendamentos,
      totalProcessos,
      totalProcessosAndamento,
      vendasHoje,
      vendasMes,
      agendamentosHoje,
      produtosEstoqueBaixo,
      ultimosProcessos,
      ultimasVendas,
      proximosAgendamentos,
      vendas6Meses,
      vendasPorCanalRaw,
      itensVendaRaw,
      petsPorEspecieRaw,
      processosStatusRaw,
      agendamentosServicoRaw,
    ] = await Promise.all([
      db.cliente.count(),
      db.pet.count(),
      db.produto.count(),
      db.venda.count(),
      db.agendamento.count(),
      db.processo.count(),
      db.processo.count({ where: { status: { in: ['novo', 'em_andamento', 'aguardando_resposta', 'andamento'] } } }),
      db.venda.findMany({
        where: { createdAt: { gte: inicioHoje }, status: { in: statusVendaValidos } },
        select: { total: true },
      }),
      db.venda.findMany({
        where: { createdAt: { gte: inicioMes, lt: fimMes }, status: { in: statusVendaValidos } },
        select: { total: true },
      }),
      db.agendamento.count({
        where: { dataHora: { gte: inicioHoje } },
      }),
      db.produto.count({ where: { estoque: { lt: 5 }, ativo: true } }),
      db.processo.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { pet: { include: { cliente: true } } },
      }),
      db.venda.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { cliente: true, itens: { include: { produto: true } } },
      }),
      db.agendamento.findMany({
        take: 5,
        where: { dataHora: { gte: hoje }, status: { in: ['agendado', 'confirmado'] } },
        orderBy: { dataHora: 'asc' },
        include: { pet: true, cliente: true },
      }),
      // Vendas dos últimos 6 meses para o LineChart
      db.venda.findMany({
        where: {
          createdAt: { gte: inicio6Meses, lt: fimJanela6Meses },
          status: { in: statusVendaValidos },
        },
        select: { total: true, canal: true, createdAt: true },
      }),
      // Vendas por canal (todos os tempos, status válidos)
      db.venda.findMany({
        where: { status: { in: statusVendaValidos } },
        select: { canal: true, total: true },
      }),
      // Itens de venda (para top produtos)
      db.itemVenda.findMany({
        where: { venda: { status: { in: statusVendaValidos } } },
        select: {
          quantidade: true,
          precoUnit: true,
          produto: { select: { nome: true } },
        },
      }),
      // Pets por espécie
      db.pet.groupBy({
        by: ['especie'],
        _count: { _all: true },
      }),
      // Processos por status
      db.processo.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      // Agendamentos por serviço
      db.agendamento.groupBy({
        by: ['servico'],
        _count: { _all: true },
      }),
    ])

    const faturamentoHoje = vendasHoje.reduce((acc, v) => acc + v.total, 0)
    const faturamentoMes = vendasMes.reduce((acc, v) => acc + v.total, 0)

    // ---- vendasPorMes: array de 6 meses terminando no mês atual ----
    const vendasPorMes: DashboardStats['vendasPorMes'] = []
    for (let i = 5; i >= 0; i--) {
      const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1)
      const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 1)
      const total = vendas6Meses
        .filter((v) => v.createdAt >= inicio && v.createdAt < fim)
        .reduce((acc, v) => acc + v.total, 0)
      vendasPorMes.push({
        mes: NOMES_MESES_PT[ref.getMonth()],
        total: Math.round(total * 100) / 100,
      })
    }

    // ---- vendasPorCanal: 3 buckets (loja, mercadolivre, amazon) ----
    const canalMap = new Map<string, { total: number; quantidade: number }>()
    for (const v of vendasPorCanalRaw) {
      const canal = normalizarCanal(v.canal)
      const atual = canalMap.get(canal) || { total: 0, quantidade: 0 }
      atual.total += v.total
      atual.quantidade += 1
      canalMap.set(canal, atual)
    }
    const vendasPorCanal: DashboardStats['vendasPorCanal'] = (
      ['loja', 'mercadolivre', 'amazon'] as const
    ).map((canal) => {
      const dados = canalMap.get(canal) || { total: 0, quantidade: 0 }
      return {
        canal,
        total: Math.round(dados.total * 100) / 100,
        quantidade: dados.quantidade,
      }
    })

    // ---- topProdutos: 5 mais vendidos por quantidade ----
    const produtoMap = new Map<string, { nome: string; quantidade: number; total: number }>()
    for (const item of itensVendaRaw) {
      const nome = item.produto?.nome || 'Produto removido'
      const atual = produtoMap.get(nome) || { nome, quantidade: 0, total: 0 }
      atual.quantidade += item.quantidade
      atual.total += item.quantidade * item.precoUnit
      produtoMap.set(nome, atual)
    }
    const topProdutos: DashboardStats['topProdutos'] = Array.from(produtoMap.values())
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5)
      .map((p) => ({
        nome: p.nome,
        quantidade: p.quantidade,
        total: Math.round(p.total * 100) / 100,
      }))

    // ---- petsPorEspecie ----
    const petsPorEspecie: DashboardStats['petsPorEspecie'] = petsPorEspecieRaw
      .map((p) => ({
        especie: p.especie || 'Não informado',
        quantidade: p._count._all,
      }))
      .sort((a, b) => b.quantidade - a.quantidade)

    // ---- processosPorStatus: 3 buckets ----
    const procStatusMap = new Map<string, number>([
      ['novo', 0],
      ['andamento', 0],
      ['finalizado', 0],
    ])
    for (const p of processosStatusRaw) {
      const bucket = normalizarStatusProcesso(p.status)
      procStatusMap.set(bucket, (procStatusMap.get(bucket) || 0) + p._count._all)
    }
    const processosPorStatus: DashboardStats['processosPorStatus'] = (
      ['novo', 'andamento', 'finalizado'] as const
    ).map((status) => ({ status, quantidade: procStatusMap.get(status) || 0 }))

    // ---- agendamentosPorServico ----
    const servicoMap = new Map<string, number>()
    for (const a of agendamentosServicoRaw) {
      const servico = normalizarServicoAgendamento(a.servico)
      servicoMap.set(servico, (servicoMap.get(servico) || 0) + a._count._all)
    }
    const agendamentosPorServico: DashboardStats['agendamentosPorServico'] = Array.from(
      servicoMap.entries()
    )
      .map(([servico, quantidade]) => ({ servico, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 6)

    const stats: DashboardStats = {
      totalClientes,
      totalPets,
      totalProdutos,
      totalVendas,
      totalAgendamentos,
      totalProcessos,
      totalProcessosAndamento,
      faturamentoHoje,
      faturamentoMes,
      vendasHoje: vendasHoje.length,
      agendamentosHoje,
      estoqueBaixo: produtosEstoqueBaixo,
      ultimosProcessos: ultimosProcessos as any,
      ultimasVendas: ultimasVendas as any,
      proximosAgendamentos: proximosAgendamentos as any,
      vendasPorMes,
      vendasPorCanal,
      topProdutos,
      petsPorEspecie,
      processosPorStatus,
      agendamentosPorServico,
    }

    return NextResponse.json(stats)
  } catch (e) {
    console.error('dashboard erro:', e)
    return NextResponse.json({ error: 'Erro ao carregar dashboard' }, { status: 500 })
  }
}
