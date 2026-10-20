import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import {
  consultarNotaMeli, consultarPedidoMeli, pedirEmissaoMeli,
  MercadoLivreFiscalError, onlyOrderId, snapshot,
  type MercadoLivreInvoice,
} from '@/lib/mercado-livre-fiscal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const inputSchema = z.object({
  vendaId: z.string().min(1).max(100),
  acao: z.enum(['consultar', 'emitir']),
  confirmacao: z.literal('EMITIR_NFE_REAL').optional(),
}).strict()

function isMeliSale(venda: { canal: string; marketplaceOrderId: string | null }) {
  const channel = venda.canal === 'mercadolivre' || venda.canal === 'mercado_livre'
  const raw = venda.marketplaceOrderId
  if (!channel || !raw || !/^mercadolivre:\d{8,20}$/.test(raw)) return null
  return onlyOrderId(raw.split(':')[1])
}

async function saveInvoice(vendaId: string, external: MercadoLivreInvoice) {
  const parsed = snapshot(external)
  const old = await db.notaFiscal.findUnique({ where: { vendaId }, select: {
    id: true, emissorDocumentoId: true, status: true, chaveAcesso: true,
  } })
  if (old?.emissorDocumentoId && old.emissorDocumentoId !== parsed.documentoId) {
    throw new MercadoLivreFiscalError('Outra nota já foi associada a esta venda. Conciliação manual obrigatória.', 409)
  }
  if (old?.chaveAcesso && parsed.chaveAcesso && old.chaveAcesso !== parsed.chaveAcesso) {
    throw new MercadoLivreFiscalError('A chave fiscal mudou em relação à nota salva. Consulte o contador.', 409)
  }
  const payload = {
    emissor: 'mercado_livre',
    emissorDocumentoId: parsed.documentoId,
    status: parsed.status,
    numero: parsed.numero,
    serie: parsed.serie,
    chaveAcesso: parsed.chaveAcesso,
    protocolo: parsed.protocolo,
    autorizadaEm: parsed.autorizadaEm,
    consultadaEm: new Date(),
    erro: parsed.erro,
  }
  await db.notaFiscal.upsert({
    where: { vendaId },
    create: { vendaId, modelo: '55', ...payload },
    update: payload,
  })
  return {
    status: parsed.status, numero: parsed.numero, serie: parsed.serie,
    chaveAcesso: parsed.chaveAcesso, documentoId: parsed.documentoId,
    possuiXml: parsed.status === 'autorizada' && !!parsed.xmlPath,
    possuiDanfe: parsed.status === 'autorizada' && !!parsed.danfePath,
    aviso: parsed.status === 'autorizada' ? 'NF-e autorizada identificada no Faturador.' :
      'A nota existe no Mercado Livre, mas ainda não foi confirmada como autorizada. Consulte novamente.',
  }
}

export async function POST(req: NextRequest) {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 })

  try {
    assertSameOrigin(req)
    const parsed = inputSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'Dados fiscais inválidos.' }, { status: 400 })
    const { vendaId, acao, confirmacao } = parsed.data

    const venda = await db.venda.findUnique({
      where: { id: vendaId },
      select: {
        id: true, canal: true, marketplaceOrderId: true,
        status: true, total: true, itens: { take: 1, select: { id: true } },
        notaFiscal: { select: { id: true, status: true, chaveAcesso: true, emissorDocumentoId: true } },
      },
    })
    if (!venda) return NextResponse.json({ error: 'Venda não encontrada.' }, { status: 404 })
    const orderId = isMeliSale(venda)
    if (!orderId) return NextResponse.json({
      error: 'Emissão pelo Faturador só é suportada para pedidos Mercado Livre importados com ID válido.',
    }, { status: 409 })

    // Consulta externa sempre antecede qualquer tentativa de emissão.
    const external = await consultarNotaMeli(orderId)
    if (external) {
      const registro = await saveInvoice(venda.id, external)
      return NextResponse.json({ ...registro, existente: true })
    }

    if (acao === 'consultar') {
      return NextResponse.json({
        existente: false,
        status: venda.notaFiscal?.status || 'sem_nota',
        aviso: venda.notaFiscal?.status === 'pendente_confirmacao' ||
          venda.notaFiscal?.status === 'emissao_solicitada'
          ? 'Emissão anterior de resultado incerto. Confira no Faturador antes de qualquer nova tentativa.'
          : 'O Faturador ainda não retornou nota fiscal para este pedido.',
      })
    }

    // Emissão real é um ato fiscal irreversível: nunca acionar sem liberação operacional explícita.
    if (process.env.MERCADO_LIVRE_NFE_EMISSAO_HABILITADA !== 'true')
      return NextResponse.json({ error: 'Emissão real ainda bloqueada. Ative somente após homologação do fluxo e confirmação com o contador.' }, { status: 423 })
    if (confirmacao !== 'EMITIR_NFE_REAL')
      return NextResponse.json({ error: 'Confirmação explícita de emissão obrigatória.' }, { status: 400 })
    if (venda.status !== 'concluida' || !(venda.total > 0) || !venda.itens.length)
      return NextResponse.json({ error: 'Pedido precisa estar pago, concluído e ter itens válidos.' }, { status: 409 })
    if (venda.notaFiscal && venda.notaFiscal.status !== 'rascunho')
      return NextResponse.json({ error: 'Já existe processo fiscal para esta venda. Consulte ou concilie a nota antes de emitir.', }, { status: 409 })
    if (venda.notaFiscal?.chaveAcesso || venda.notaFiscal?.emissorDocumentoId)
      return NextResponse.json({ error: 'Nota fiscal externa já identificada. Emissão duplicada bloqueada.' }, { status: 409 })

    // Checagem independente com o ML: vendedor, pagamento e packs.
    await consultarPedidoMeli(orderId)

    // Claim atômico: evita dois administradores pedindo emissão da mesma venda simultaneamente.
    await db.notaFiscal.upsert({
      where: { vendaId },
      create: { vendaId, modelo: '55', status: 'rascunho' },
      update: {},
    })
    const claimed = await db.notaFiscal.updateMany({
      where: { vendaId, status: 'rascunho', emissorDocumentoId: null, chaveAcesso: null },
      data: { status: 'emissao_solicitada', emissor: 'mercado_livre', emissaoSolicitadaEm: new Date(), erro: null },
    })
    if (claimed.count !== 1)
      return NextResponse.json({ error: 'Outra emissão/consulta fiscal já foi iniciada. Consulte novamente.' }, { status: 409 })

    // Após o claim não fazemos reenvio automático, mesmo em caso de timeout.
    try {
      const issued = await pedirEmissaoMeli(orderId)
      const registro = await saveInvoice(venda.id, issued)
      return NextResponse.json({ ...registro, existente: false, solicitada: true })
    } catch (error) {
      await db.notaFiscal.updateMany({
        where: { vendaId, status: 'emissao_solicitada' },
        data: {
          status: 'pendente_confirmacao',
          consultadaEm: new Date(),
          erro: 'Resultado não confirmado. Consulte no Mercado Livre antes de tentar novamente.',
        },
      })
      throw error
    }
  } catch (error) {
    if (error instanceof MercadoLivreFiscalError)
      return NextResponse.json({ error: error.message }, { status: error.httpStatus })
    console.error('Mercado Livre fiscal:', error)
    return NextResponse.json({ error: 'Falha ao comunicar com o Faturador. Não repita a emissão sem consultar a nota.' }, { status: 503 })
  }
}
