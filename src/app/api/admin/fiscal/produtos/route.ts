import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import { pendenciasClassificacaoSimples, validarCamposFiscaisSimples } from '@/lib/fiscal-simples-produto'

async function authorize() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  const denied = await authorize()
  if (denied) return denied
  try {
    const search = (req.nextUrl.searchParams.get('busca') || '').trim().slice(0, 80)
    const page = Math.max(1, Math.min(1000, Number(req.nextUrl.searchParams.get('pagina')) || 1))
    const where = search ? { OR: [
      { nome: { contains: search, mode: 'insensitive' as const } },
      { sku: { contains: search, mode: 'insensitive' as const } },
    ] } : {}
    const [total, produtos] = await Promise.all([
      db.produto.count({ where }),
      db.produto.findMany({
        where, orderBy: { nome: 'asc' }, skip: (page - 1) * 30, take: 30,
        select: { id: true, nome: true, sku: true, ncm: true, cest: true, cfop: true, origem: true, cst: true, csosn: true, unidadeFiscal: true,
          gtinFiscal: true, pisCst: true, cofinsCst: true, ipiCst: true, ibsCbsCst: true, ibsCbsClassTrib: true },
      }),
    ])
    return NextResponse.json({ produtos: produtos.map(p => ({ ...p, pendencias: pendenciasClassificacaoSimples(p) })), total, pagina: page, porPagina: 30 })
  } catch (error) {
    console.error('fiscal produtos GET', error)
    return NextResponse.json({ error: 'Não foi possível listar a tributação dos produtos.' }, { status: 500 })
  }
}

const taxSchema = z.object({
  id: z.string().min(1).max(80),
  ncm: z.string().max(10).nullish(),
  cest: z.string().max(9).nullish(),
  cfop: z.string().max(4).nullish(),
  origem: z.string().regex(/^[0-8]$/).nullish(),
  cst: z.string().max(3).nullish(),
  csosn: z.string().max(3).nullish(),
  unidadeFiscal: z.string().max(6).nullish(),
  gtinFiscal: z.string().max(14).nullish(),
  pisCst: z.string().max(2).nullish(),
  cofinsCst: z.string().max(2).nullish(),
  ipiCst: z.string().max(2).nullish(),
  ibsCbsCst: z.string().max(3).nullish(),
  ibsCbsClassTrib: z.string().max(6).nullish(),
}).strict()

export async function PATCH(req: NextRequest) {
  const denied = await authorize()
  if (denied) return denied
  try {
    assertSameOrigin(req)
    const parsed = taxSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'Dados fiscais inválidos.' }, { status: 400 })
    const { id, ...rest } = parsed.data
    const normalize = (value: string | null | undefined) => value?.trim().toUpperCase() || null
    const ncm = normalize(rest.ncm)?.replace(/\D/g, '') || null
    const cest = normalize(rest.cest)?.replace(/\D/g, '') || null
    const cfop = normalize(rest.cfop)?.replace(/\D/g, '') || null
    if (ncm && ncm.length !== 8) return NextResponse.json({ error: 'NCM deve ter 8 dígitos.' }, { status: 400 })
    if (cest && cest.length !== 7) return NextResponse.json({ error: 'CEST deve ter 7 dígitos.' }, { status: 400 })
    if (cfop && cfop.length !== 4) return NextResponse.json({ error: 'CFOP deve ter 4 dígitos.' }, { status: 400 })
    const campos = {
      ncm, cest, cfop,
      origem: normalize(rest.origem), cst: normalize(rest.cst),
      csosn: normalize(rest.csosn), unidadeFiscal: normalize(rest.unidadeFiscal),
      gtinFiscal: normalize(rest.gtinFiscal), pisCst: normalize(rest.pisCst),
      cofinsCst: normalize(rest.cofinsCst), ipiCst: normalize(rest.ipiCst),
      ibsCbsCst: normalize(rest.ibsCbsCst),
      ibsCbsClassTrib: normalize(rest.ibsCbsClassTrib),
    }
    const erros = validarCamposFiscaisSimples(campos)
    if (erros.length) return NextResponse.json({ error: erros.join(' ') }, { status: 400 })
    const produto = await db.produto.update({
      where: { id },
      data: campos,
      select: { id: true, nome: true, ncm: true, cest: true, cfop: true, origem: true, cst: true, csosn: true, unidadeFiscal: true,
        gtinFiscal:true,pisCst:true,cofinsCst:true,ipiCst:true,ibsCbsCst:true,ibsCbsClassTrib:true },
    })
    return NextResponse.json({ ...produto, pendencias: pendenciasClassificacaoSimples(produto) })
  } catch (error) {
    console.error('fiscal produtos PATCH', error)
    return NextResponse.json({ error: 'Não foi possível salvar os dados fiscais do produto.' }, { status: 500 })
  }
}
