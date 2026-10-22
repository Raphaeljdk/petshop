import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { paidSaleWhere } from '@/lib/sales-policy'
import { arredondarMoeda } from '@/lib/dashboard-comercial'

export const dynamic = 'force-dynamic'
export async function GET() {
  const usuario = await getUsuarioLogado()
  if (!usuario) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (usuario.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  try {
    // A operação é local no PostgreSQL. Nenhuma chamada ao Siggma/Zetta.
    const hoje = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const inicioDia = new Date(hoje + 'T00:00:00-03:00')
    const fimDia = new Date(inicioDia.getTime() + 86400000)
    const anoMes = hoje.slice(0, 7)
    const inicioMes = new Date(anoMes + '-01T00:00:00-03:00')
    const [clientes,pets,produtos,atendimentos,agendamentosHoje,vendasPendentes,estoqueBaixo,
      notasPendentes,notasEmitidas,receita,ultimosAtendimentos,proximosAgendamentos,contasPortal] = await Promise.all([
      db.cliente.count({ where: { ativo: true } }),
      db.pet.count({ where: { ativo: true, cliente: { ativo: true } } }),
      db.produto.count({ where: { ativo: true } }),
      db.processo.count({ where: { status: { not: 'cancelado' } } }),
      db.agendamento.count({ where: { dataHora: { gte: inicioDia, lt: fimDia }, status: { not: 'cancelado' } } }),
      db.venda.count({ where: { status: 'pendente' } }),
      db.produto.count({ where: { ativo: true, estoqueIlimitado: false, estoque: { lt: 5 } } }),
      db.notaFiscal.count({ where: { status: { in: ['rascunho','pendente','erro'] } } }),
      db.notaFiscal.count({ where: { modelo: '55', status: 'autorizada', canceladaEm: null } }),
      db.venda.aggregate({ where: { ...paidSaleWhere, createdAt: { gte: inicioMes, lte: new Date() } }, _sum: { total: true }, _count: { id: true } }),
      db.processo.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, servico: true, valorServico: true, createdAt: true, pet: { select: { nome: true, cliente: { select: { nome: true } } } } } }),
      db.agendamento.findMany({ where: { dataHora: { gte: new Date() }, status: { in: ['agendado','confirmado'] } }, orderBy: { dataHora: 'asc' }, take: 5, select: { id: true, status: true, dataHora: true, servico: true, pet: { select: { nome: true } }, cliente: { select: { nome: true } } } }),
      db.user.count({ where: { role: 'CLIENTE', ativo: true } }),
    ])
    return NextResponse.json({
      clientes,pets,produtos,atendimentos,agendamentosHoje,vendasPendentes,estoqueBaixo,
      notasPendentes,notasEmitidas,receitaMes: arredondarMoeda(receita._sum.total || 0),vendasMes: receita._count.id,
      contasPortal,ultimosAtendimentos,proximosAgendamentos,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('dashboard ERP GET:', e)
    return NextResponse.json({ error: 'Erro ao consultar indicadores locais do ERP.' }, { status: 500 })
  }
}
