import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { paidSaleWhere } from '@/lib/sales-policy'
import { arredondarMoeda, diaSaoPaulo, periodoComercial, proximosAniversarios } from '@/lib/dashboard-comercial'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Canal = 'loja' | 'mercadolivre' | 'amazon' | 'outros'
const CANAIS: { id: Canal; nome: string }[] = [
  { id: 'loja', nome: 'Loja / site' },
  { id: 'mercadolivre', nome: 'Mercado Livre' },
  { id: 'amazon', nome: 'Amazon' },
  { id: 'outros', nome: 'Outros canais' },
]

function canalNormalizado(canal: string): Canal {
  const value = canal.toLowerCase().replace(/[\s_-]/g, '')
  if (value === 'mercadolivre' || value === 'meli') return 'mercadolivre'
  if (value === 'amazon') return 'amazon'
  if (value === 'loja' || value === 'site' || value === 'ecommerce' || value === 'pdv') return 'loja'
  return 'outros'
}

export async function GET(request: NextRequest) {
  const usuario = await getUsuarioLogado()
  if (!usuario) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (usuario.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 })

  const periodo = Number(request.nextUrl.searchParams.get('dias') || 30)
  if (![7, 30, 90].includes(periodo))
    return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })

  try {
    const agora = new Date()
    const { inicio, datas } = periodoComercial(periodo as 7 | 30 | 90, agora)
    const periodoVenda = {
      ...paidSaleWhere,
      createdAt: { gte: inicio, lte: agora },
    }
    const [vendas, canaisVendas, produtosVendidos, clientesQueCompraram, notas, semDataFiscal, pets, vendasDia] = await Promise.all([
      db.venda.aggregate({
        where: periodoVenda, _sum: { total: true }, _count: { id: true },
      }),
      db.venda.groupBy({
        by: ['canal'], where: periodoVenda,
        _sum: { total: true }, _count: { id: true },
      }),
      db.itemVenda.groupBy({
        by: ['produtoId'], where: { venda: periodoVenda },
        _sum: { quantidade: true },
        orderBy: [{ _sum: { quantidade: 'desc' } }, { produtoId: 'asc' }], take: 8,
      }),
      db.venda.groupBy({
        by: ['clienteId'],
        where: { ...periodoVenda, clienteId: { not: null } },
        _sum: { total: true }, _count: { id: true },
        orderBy: [{ _sum: { total: 'desc' } }, { clienteId: 'asc' }], take: 8,
      }),
      // A autorização fiscal independe do status de pagamento da venda.
      // Apurar pela data da autorização, excluindo cancelamentos e outros modelos.
      db.notaFiscal.findMany({
        where: {
          modelo: '55',
          status: 'autorizada',
          canceladaEm: null,
          autorizadaEm: { gte: inicio, lte: agora },
        },
        select: { id: true, autorizadaEm: true, venda: { select: { canal: true, total: true } } },
      }),
      db.notaFiscal.count({
        where: { modelo: '55', status: 'autorizada', canceladaEm: null, autorizadaEm: null },
      }),
      db.pet.findMany({
        where: { ativo: true, cliente: { ativo: true }, nascimento: { not: null } },
        select: { id: true, nome: true, nascimento: true, cliente: { select: { nome: true } } },
      }),
      db.venda.findMany({
        where: periodoVenda,
        select: { total: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const [produtos, clientes] = await Promise.all([
      db.produto.findMany({
        where: { id: { in: produtosVendidos.map((x) => x.produtoId) } },
        select: { id: true, nome: true },
      }),
      db.cliente.findMany({
        where: { id: { in: clientesQueCompraram.flatMap((x) => x.clienteId ? [x.clienteId] : []) } },
        select: { id: true, nome: true },
      }),
    ])
    const nomeProduto = new Map(produtos.map((x) => [x.id, x.nome]))
    const nomeCliente = new Map(clientes.map((x) => [x.id, x.nome]))

    const porCanal = CANAIS.map(({ id, nome }) => ({
      id, nome, pedidos: 0, vendido: 0, notasAutorizadas: 0, faturadoNfe: 0,
    }))
    for (const item of canaisVendas) {
      const canal = porCanal.find((x) => x.id === canalNormalizado(item.canal))!
      canal.pedidos += item._count.id
      canal.vendido = arredondarMoeda(canal.vendido + (item._sum.total || 0))
    }
    for (const nota of notas) {
      const canal = porCanal.find((x) => x.id === canalNormalizado(nota.venda.canal))!
      canal.notasAutorizadas += 1
      canal.faturadoNfe = arredondarMoeda(canal.faturadoNfe + nota.venda.total)
    }

    const mapaDias = new Map(datas.map((dia) => [dia, { dia, vendido: 0, faturadoNfe: 0 }]))
    for (const venda of vendasDia) {
      const dia = diaSaoPaulo(venda.createdAt)
      const item = mapaDias.get(dia)
      if (item) item.vendido = arredondarMoeda(item.vendido + venda.total)
    }
    for (const nota of notas) {
      if (!nota.autorizadaEm) continue
      const dia = diaSaoPaulo(nota.autorizadaEm)
      const item = mapaDias.get(dia)
      if (item) item.faturadoNfe = arredondarMoeda(item.faturadoNfe + nota.venda.total)
    }

    const faturadoNfe = notas.reduce((total, nota) => arredondarMoeda(total + nota.venda.total), 0)
    const valorVendido = arredondarMoeda(vendas._sum.total || 0)
    const quantidadeVendas = vendas._count.id
    return NextResponse.json({
      dias: periodo,
      periodo: { inicio: inicio.toISOString(), fim: agora.toISOString() },
      indicadores: {
        vendido: valorVendido,
        pedidos: quantidadeVendas,
        ticketMedio: quantidadeVendas ? arredondarMoeda(valorVendido / quantidadeVendas) : 0,
        faturadoNfe,
        notasAutorizadas: notas.length,
        notasAutorizadasSemData: semDataFiscal,
      },
      canais: porCanal,
      maisVendidos: produtosVendidos.map((x) => ({
        id: x.produtoId,
        nome: nomeProduto.get(x.produtoId) || 'Produto removido',
        quantidade: x._sum.quantidade || 0,
      })),
      melhoresClientes: clientesQueCompraram.map((x) => ({
        id: x.clienteId,
        nome: (x.clienteId && nomeCliente.get(x.clienteId)) || 'Cliente não cadastrado',
        compras: x._count.id,
        total: arredondarMoeda(x._sum.total || 0),
      })),
      aniversarios: proximosAniversarios(pets, agora),
      evolucao: Array.from(mapaDias.values()).sort((a, b) => a.dia.localeCompare(b.dia)),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('dashboard comercial GET:', error)
    return NextResponse.json({ error: 'Não foi possível carregar o dashboard comercial.' }, { status: 500 })
  }
}
