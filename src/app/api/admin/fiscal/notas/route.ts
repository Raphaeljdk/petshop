import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'

export async function POST(req: NextRequest) {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  try {
    assertSameOrigin(req)
    const input = z.object({ vendaId: z.string().min(1).max(80) }).strict().safeParse(await req.json())
    if (!input.success) return NextResponse.json({ error: 'Selecione uma venda válida.' }, { status: 400 })
    const venda = await db.venda.findUnique({
      where: { id: input.data.vendaId },
      select: { id: true, canal: true, status: true, mercadoPagoStatus: true, total: true, itens: { select: { id: true } } },
    })
    if (!venda) return NextResponse.json({ error: 'Venda não encontrada.' }, { status: 404 })
    if (venda.status === 'cancelada') return NextResponse.json({ error: 'Venda cancelada não pode gerar nota.' }, { status: 409 })
    if (!['site', 'amazon', 'mercado_livre', 'mercadolivre'].includes(venda.canal)) {
      return NextResponse.json({ error: 'Venda presencial exige classificação própria e módulo NFC-e (65); não pode ser transformada em online pelo dispositivo usado.' }, { status: 409 })
    }
    if (venda.status !== 'concluida' && !['approved', 'authorized'].includes(venda.mercadoPagoStatus || '')) {
      return NextResponse.json({ error: 'Confirme o pagamento da venda antes de preparar a NF-e.' }, { status: 409 })
    }
    if (!venda.itens.length || !(venda.total > 0)) return NextResponse.json({ error: 'Venda sem itens/valor válido.' }, { status: 409 })
    const config = await db.configuracaoFiscal.findUnique({ where: { id: 'matilha-prado' }, select: { serieNfe: true } })
    // A restrição UNIQUE em vendaId garante que cada pedido tenha um único registro fiscal.
    // Não reservamos número/chave nesta etapa e nunca simulamos autorização da SEFAZ.
    const nota = await db.notaFiscal.upsert({
      where: { vendaId: venda.id },
      create: { vendaId: venda.id, modelo: '55', status: 'rascunho', serie: config?.serieNfe || 1 },
      update: {},
    })
    return NextResponse.json({
      nota,
      aviso: 'Rascunho salvo no ERP. A emissão NF-e está bloqueada até a homologação fiscal.',
    }, { status: 201 })
  } catch (error) {
    console.error('fiscal notas POST', error)
    return NextResponse.json({ error: 'Não foi possível preparar o rascunho da nota.' }, { status: 500 })
  }
}
