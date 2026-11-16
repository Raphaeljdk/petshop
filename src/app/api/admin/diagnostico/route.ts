import { NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { db } from '@/lib/db'
import { diagnosticarCatalogo, identificarChoquesAgenda } from '@/lib/operational-insights'
import { proximosAniversarios } from '@/lib/dashboard-comercial'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Visão de diagnóstico somente leitura; não inicia sincronizações nem emite NF-e. */
export async function GET() {
  const usuario = await getUsuarioLogado()
  if (!usuario) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (usuario.role !== 'ADMIN')
    return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 })

  try {
    const agora = new Date()
    const emSeteDias = new Date(agora.getTime() + 7 * 86400_000)
    const [produtos, agendamentos, solicitacoes, pedidos, notasPendentes,
      notasComErro, notasRascunho, notasAutorizadas, notasRecentes, lembretes, favoritos, integracoes, pets] = await Promise.all([
      db.produto.findMany({
        select: {
          id: true, nome: true, descricao: true, categoria: true, sku: true,
          imageUrl: true, preco: true, estoque: true, estoqueHub: true,
          estoqueZetta: true, estoqueMercadoLivre: true, estoqueAmazon: true,
          estoqueIlimitado: true, zettaProCod: true, mlItemId: true,
          amazonAsin: true, ativo: true,
        },
      }),
      db.agendamento.findMany({
        where: { dataHora: { gte: agora, lte: emSeteDias }, status: { in: ['agendado', 'confirmado'] } },
        select: { id: true, profissionalId: true, dataHora: true, status: true, pet: { select: { nome: true } } },
        orderBy: { dataHora: 'asc' },
      }),
      db.bookingRequest.count({ where: { status: 'solicitado' } }),
      db.venda.count({ where: { status: 'pendente' } }),
      db.notaFiscal.count({ where: { status: 'pendente' } }),
      db.notaFiscal.count({ where: { status: { in: ['erro', 'rejeitada'] } } }),
      db.notaFiscal.count({ where: { status: 'rascunho' } }),
      db.notaFiscal.count({ where: { status: 'autorizada', modelo: '55', canceladaEm: null } }),
      db.notaFiscal.findMany({
        where: { status: { in: ['erro', 'rejeitada', 'pendente'] } },
        orderBy: { updatedAt: 'desc' }, take: 6,
        select: { id: true, status: true, erro: true, serie: true, numero: true, emissor: true },
      }),
      db.customerPreference.count({ where: { reminderAt: { lte: agora } } }),
      db.customerPreference.count({ where: { favorite: true } }),
      db.integracao.findMany({ select: { plataforma: true, ativo: true, ultimaSync: true }, orderBy: { plataforma: 'asc' } }),
      db.pet.findMany({ where: { ativo: true, nascimento: { not: null }, cliente: { ativo: true } },
        select: { id: true, nome: true, nascimento: true, cliente: { select: { nome: true } } } }),
    ])
    const catalogo = diagnosticarCatalogo(produtos)
    const conflitos = identificarChoquesAgenda(agendamentos)
    const estoqueCritico = produtos.filter((p) => p.ativo && !p.estoqueIlimitado && p.estoque < 5).length

    return NextResponse.json({
      atualizadoEm: agora.toISOString(),
      catalogo,
      pendencias: {
        solicitacoes, pedidos, estoqueCritico, notasPendentes, notasComErro,
        conflitosAgenda: conflitos.length,
      },
      fiscal: {
        notasRascunho, notasAutorizadas,
        recentes: notasRecentes.map((nota) => ({
          ...nota, erro: nota.erro?.slice(0, 250) || null,
        })),
      },
      agenda: { conflitos: conflitos.slice(0, 6), totalDaSemana: agendamentos.length },
      relacionamento: { lembretesVencidos: lembretes, favoritosSalvos: favoritos,
        aniversarios: proximosAniversarios(pets, agora).slice(0, 6) },
      integracoes: integracoes.map(({ plataforma, ativo, ultimaSync }) =>
        ({ plataforma, ativo, ultimaSync })),
      custosDetalhadosDisponiveis: false,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('diagnostico Matilha Prado:', error)
    return NextResponse.json({ error: 'Não foi possível consultar o diagnóstico operacional.' }, { status: 500 })
  }
}
