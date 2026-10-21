import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { AuthError, readAuthBody } from '@/lib/auth-http'
import { gerarPreviaXml, PreviewError } from '@/lib/fiscal-preview'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const failure = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

/** Somente leitura. Não usa A1, não cria NotaFiscal nem acessa serviços externos. */
export async function POST(req: NextRequest) {
  const user = await getUsuarioLogado()
  if (!user) return failure('Não autenticado.', 401)
  if (user.role !== 'ADMIN') return failure('Acesso negado.', 403)
  try {
    const input = z.object({ vendaId: z.string().min(1).max(80) }).strict().safeParse(await readAuthBody(req))
    if (!input.success) return failure('Selecione uma venda válida.', 400)
    const venda = await db.venda.findUnique({
      where: { id: input.data.vendaId },
      include: { cliente: true, itens: { include: { produto: true }, orderBy: { id: 'asc' } } },
    })
    if (!venda) return failure('Venda não encontrada.', 404)
    const empresa = await db.configuracaoFiscal.findUnique({ where: { id: 'matilha-prado' } })
    const { xml } = gerarPreviaXml(venda, empresa)
    const safeId = venda.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'venda'
    return new NextResponse(xml, { headers: {
      ...headers, 'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="PREVIA-SEM-VALIDADE-FISCAL-${safeId}.xml"`,
    } })
  } catch (error) {
    if (error instanceof AuthError) return failure(error.message, error.status)
    if (error instanceof PreviewError) return failure(error.message, 409)
    console.error('Falha ao gerar prévia fiscal XML.')
    return failure('Não foi possível gerar a prévia XML. Tente novamente.', 500)
  }
}
