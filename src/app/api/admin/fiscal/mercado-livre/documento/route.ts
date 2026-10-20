import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { baixarDocumentoMeli, consultarNotaMeli, onlyOrderId, snapshot, MercadoLivreFiscalError } from '@/lib/mercado-livre-fiscal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  try {
    const vendaId = req.nextUrl.searchParams.get('vendaId') || ''
    const tipo = req.nextUrl.searchParams.get('tipo')
    if (!vendaId || vendaId.length > 100 || (tipo !== 'xml' && tipo !== 'danfe'))
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
    const venda = await db.venda.findUnique({ where: { id: vendaId }, select: {
      canal: true, marketplaceOrderId: true, notaFiscal: { select: { status: true, emissorDocumentoId: true } },
    } })
    if (!venda || !['mercadolivre','mercado_livre'].includes(venda.canal) ||
        !venda.marketplaceOrderId || !/^mercadolivre:\d{8,20}$/.test(venda.marketplaceOrderId))
      return NextResponse.json({ error: 'Venda Mercado Livre inválida.' }, { status: 404 })

    const invoice = await consultarNotaMeli(onlyOrderId(venda.marketplaceOrderId.split(':')[1]))
    if (!invoice) return NextResponse.json({ error: 'NF-e não encontrada no Faturador.' }, { status: 404 })
    const snap = snapshot(invoice)
    if (snap.status !== 'autorizada')
      return NextResponse.json({ error: 'A NF-e ainda não consta como autorizada.' }, { status: 409 })
    if (venda.notaFiscal?.emissorDocumentoId &&
        venda.notaFiscal.emissorDocumentoId !== snap.documentoId)
      return NextResponse.json({ error: 'Documento externo divergente do registro local.' }, { status: 409 })
    const caminho = tipo === 'xml' ? snap.xmlPath : snap.danfePath
    if (!caminho) return NextResponse.json({ error: 'Documento ainda não disponível no Faturador.' }, { status: 404 })
    const bytes = await baixarDocumentoMeli(caminho, tipo)
    const file = 'NFe-' + (snap.chaveAcesso || vendaId.slice(-12)) + '.' + (tipo === 'xml' ? 'xml' : 'pdf')
    return new Response(bytes, {
      headers: {
        'Content-Type': tipo === 'xml' ? 'application/xml; charset=utf-8' : 'application/pdf',
        'Content-Disposition': 'attachment; filename="' + file + '"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof MercadoLivreFiscalError)
      return NextResponse.json({ error: error.message }, { status: error.httpStatus })
    console.error('Mercado Livre documento fiscal:', error)
    return NextResponse.json({ error: 'Não foi possível baixar o documento fiscal.' }, { status: 503 })
  }
}
