import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { paidSaleWhere } from '@/lib/customer-experience'

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

function diaSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(data)
}

function proximosAniversarios(pets: Array<{
  id: string
  nome: string
  nascimento: Date | null
  cliente: { nome: string }
}>, hoje: Date) {
  const [ano, mes, dia] = diaSaoPaulo(hoje).split('-').map(Number)
  const meiaNoiteUtc = Date.UTC(ano, mes - 1, dia)
  return pets.flatMap((pet) => {
    const nascimento = pet.nascimento
    if (!nascimento || nascimento.getUTCFullYear() > ano) return []
    const mesAniversario = nascimento.getUTCMonth()
    const diaAniversario = nascimento.getUTCDate()
    function ocorrencia(anoAlvo: number) {
      // Para nascidos em 29/02, considerar 28/02 nos anos não bissextos.
      const ultimoDia = new Date(Date.UTC(anoAlvo, mesAniversario + 1, 0)).getUTCDate()
      return Date.UTC(anoAlvo, mesAniversario, Math.min(diaAniversario, ultimoDia))
    }
    let proximo = ocorrencia(ano)
    let anoProximo = ano
    if (proximo < meiaNoiteUtc) {
      anoProximo += 1
      proximo = ocorrencia(anoProximo)
    }
    const dias = Math.round((proximo - meiaNoiteUtc) / 86400000)
    if (dias < 0 || dias > 30) return []
    return [{
      id: pet.id,
      nome: pet.nome,
      tutor: pet.cliente.nome,
      data: new Date(proximo).toISOString().slice(0, 10),
      dias,
      idade: anoProximo - nascimento.getUTCFullYear(),
    }]
  }).sort((a, b) => a.dias - b.dias || a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 12)
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
    const inicio = new Date(agora.getTime() - periodo * 86400000)
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
        orderBy: { _sum: { quantidade: 'desc' } }, take: 8,
      }),
      db.venda.groupBy({
        by: ['clienteId'],
        where: { ...periodoVenda, clienteId: { not: null } },
        _sum: { total: true }, _count: { id: true },
        orderBy: { _sum: { total: 'desc' } }, take: 8,
      }),
      // Data fiscal: autorização da NF-e, não criação do pedido nem rascunho.
      db.notaFiscal.findMany({
        where: {
          status: 'autorizada',
          canceladaEm: null,
          autorizadaEm: { gte: inicio, lte: agora },
          venda: paidSaleWhere,
        },
        select: { id: true, autorizadaEm: true, venda: { select: { canal: true, total: true } } },
      }),
      db.notaFiscal.count({
        where: { status: 'autorizada', canceladaEm: null, autorizadaEm: null },
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
      canal.vendido += item._sum.total || 0
    }
    for (const nota of notas) {
      const canal = porCanal.find((x) => x.id === canalNormalizado(nota.venda.canal))!
      canal.notasAutorizadas += 1
      canal.faturadoNfe += nota.venda.total
    }

    const mapaDias = new Map<string, { dia: string; vendido: number; faturadoNfe: number }>()
    for (let i = 0; i <= periodo; i++) {
      const d = new Date(inicio.getTime() + i * 86400000)
      const dia = diaSaoPaulo(d)
      if (!mapaDias.has(dia)) mapaDias.set(dia, { dia, vendido: 0, faturadoNfe: 0 })
    }
    for (const venda of vendasDia) {
      const dia = diaSaoPaulo(venda.createdAt)
      const item = mapaDias.get(dia)
      if (item) item.vendido += venda.total
    }
    for (const nota of notas) {
      if (!nota.autorizadaEm) continue
      const dia = diaSaoPaulo(nota.autorizadaEm)
      const item = mapaDias.get(dia)
      if (item) item.faturadoNfe += nota.venda.total
    }

    const faturadoNfe = notas.reduce((total, nota) => total + nota.venda.total, 0)
    const valorVendido = vendas._sum.total || 0
    const quantidadeVendas = vendas._count.id
    return NextResponse.json({
      dias: periodo,
      periodo: { inicio: inicio.toISOString(), fim: agora.toISOString() },
      indicadores: {
        vendido: valorVendido,
        pedidos: quantidadeVendas,
        ticketMedio: quantidadeVendas ? valorVendido / quantidadeVendas : 0,
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
        total: x._sum.total || 0,
      })),
      aniversarios: proximosAniversarios(pets, agora),
      evolucao: Array.from(mapaDias.values()).sort((a, b) => a.dia.localeCompare(b.dia)),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('dashboard comercial GET:', error)
    return NextResponse.json({ error: 'Não foi possível carregar o dashboard comercial.' }, { status: 500 })
  }
}
