import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

type ExportType =
  | 'vendas'
  | 'agendamentos'
  | 'clientes'
  | 'produtos'
  | 'entregas'

const VALID_TYPES: ExportType[] = [
  'vendas',
  'agendamentos',
  'clientes',
  'produtos',
  'entregas',
]

/**
 * Helper para escapar valores CSV (RFC 4180):
 * - Se contiver vírgula, aspas ou quebra de linha, envolve em aspas duplas
 * - Aspas duplas internas viram duas aspas duplas
 */
function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsv(headers: string[], rows: string[][]): string {
  const head = headers.join(',')
  const body = rows.map((r) => r.map(escapeCsv).join(',')).join('\n')
  // BOM UTF-8 para acentuação correta no Excel
  return `\uFEFF${head}\n${body}`
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function GET(req: NextRequest) {
  try {
    // Autenticação: apenas ADMIN
    const usuario = await getUsuarioLogado()
    if (!usuario) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (usuario.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const type = req.nextUrl.searchParams.get('type') as ExportType | null
    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: 'Tipo inválido. Use: vendas, agendamentos, clientes ou produtos.' },
        { status: 400 }
      )
    }

    // ----- VENDAS -----
    if (type === 'vendas') {
      const vendas = await db.venda.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          cliente: true,
          itens: { include: { produto: true } },
        },
      })
      const headers = ['ID', 'Data', 'Cliente', 'Total', 'Canal', 'Status', 'Itens']
      const rows = vendas.map((v) => [
        v.id,
        format(v.createdAt, 'dd/MM/yyyy HH:mm'),
        v.cliente?.nome || '',
        v.total.toFixed(2),
        v.canal,
        v.status,
        (v.itens || [])
          .map((i) => `${i.quantidade}x ${i.produto?.nome || 'produto'}`)
          .join(' | '),
      ])
      return csvResponse(buildCsv(headers, rows), 'vendas.csv')
    }

    // ----- AGENDAMENTOS -----
    if (type === 'agendamentos') {
      const agendamentos = await db.agendamento.findMany({
        orderBy: { dataHora: 'asc' },
        include: {
          pet: true,
          cliente: true,
        },
      })
      const headers = ['ID', 'Data/Hora', 'Pet', 'Cliente', 'Serviço', 'Status']
      const rows = agendamentos.map((a) => [
        a.id,
        format(a.dataHora, 'dd/MM/yyyy HH:mm'),
        a.pet?.nome || '',
        a.cliente?.nome || '',
        a.servico,
        a.status,
      ])
      return csvResponse(buildCsv(headers, rows), 'agendamentos.csv')
    }

    // ----- CLIENTES -----
    if (type === 'clientes') {
      const clientes = await db.cliente.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          pets: { select: { id: true } },
          vendas: { select: { id: true, total: true } },
        },
      })
      const headers = [
        'ID',
        'Nome',
        'Telefone',
        'Email',
        'CEP',
        'Endereço',
        'Total Pets',
        'Total Vendas',
      ]
      const rows = clientes.map((c) => [
        c.id,
        c.nome,
        c.telefone,
        c.email || '',
        c.cep || '',
        c.endereco || '',
        String(c.pets?.length || 0),
        (c.vendas || []).reduce((acc, v) => acc + (v.total || 0), 0).toFixed(2),
      ])
      return csvResponse(buildCsv(headers, rows), 'clientes.csv')
    }

    // ----- PRODUTOS -----
    if (type === 'produtos') {
      const produtos = await db.produto.findMany({
        orderBy: { createdAt: 'desc' },
      })
      const headers = [
        'ID',
        'Nome',
        'Categoria',
        'Preço',
        'Estoque',
        'SKU',
        'ML ID',
        'Amazon ASIN',
      ]
      const rows = produtos.map((p) => [
        p.id,
        p.nome,
        p.categoria,
        p.preco.toFixed(2),
        String(p.estoque),
        p.sku || '',
        p.mlItemId || '',
        p.amazonAsin || '',
      ])
      return csvResponse(buildCsv(headers, rows), 'produtos.csv')
    }

    // ----- ENTREGAS -----
    if (type === 'entregas') {
      const vendas = await db.venda.findMany({
        where: {
          tipoEntrega: { not: null },
          NOT: { tipoEntrega: 'retirada' },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          cliente: true,
          itens: { include: { produto: true } },
        },
      })
      const headers = [
        'ID Pedido',
        'Data',
        'Cliente',
        'Telefone',
        'Tipo Entrega',
        'CEP',
        'Endereço',
        'Prazo',
        'Valor Frete',
        'Status Entrega',
        'Código Rastreio',
        'Itens',
      ]
      const rows = vendas.map((v) => [
        v.id,
        format(v.createdAt, 'dd/MM/yyyy HH:mm'),
        v.cliente?.nome || '',
        v.cliente?.telefone || '',
        v.tipoEntrega || '',
        v.cepEntrega || '',
        v.enderecoEntrega || '',
        v.prazoEntrega || '',
        (v.valorFrete ?? 0).toFixed(2),
        v.statusEntrega || 'pendente',
        v.codigoRastreio || '',
        (v.itens || [])
          .map((i) => `${i.quantidade}x ${i.produto?.nome || 'produto'}`)
          .join(' | '),
      ])
      return csvResponse(buildCsv(headers, rows), 'entregas.csv')
    }

    return NextResponse.json({ error: 'Tipo não tratado' }, { status: 400 })
  } catch (e) {
    console.error('export erro:', e)
    return NextResponse.json({ error: 'Erro ao gerar CSV' }, { status: 500 })
  }
}
