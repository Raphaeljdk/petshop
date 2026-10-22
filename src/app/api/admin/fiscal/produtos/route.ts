import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
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
    const filtro = req.nextUrl.searchParams.get('filtro') || 'todos'
    const vazio = (campo: 'ncm' | 'gtinFiscal' | 'cfop' | 'csosn' | 'pisCst' | 'cofinsCst'): Prisma.ProdutoWhereInput => ({
      OR: [{ [campo]: null }, { [campo]: '' }],
    })
    const faltaPisCofins: Prisma.ProdutoWhereInput = {
      OR: [vazio('pisCst'), vazio('cofinsCst')],
    }
    const pendencia: Prisma.ProdutoWhereInput = {
      OR: [vazio('ncm'), vazio('gtinFiscal'), vazio('cfop'), vazio('csosn'), vazio('pisCst'), vazio('cofinsCst')],
    }
    const filtros: Record<string, Prisma.ProdutoWhereInput> = {
      todos: {}, sem_ncm: vazio('ncm'), sem_gtin: vazio('gtinFiscal'),
      sem_cfop: vazio('cfop'), sem_csosn: vazio('csosn'),
      sem_pis_cofins: faltaPisCofins, pendentes: pendencia,
    }
    if (!(filtro in filtros)) return NextResponse.json({ error: 'Filtro fiscal inválido.' }, { status: 400 })
    const busca: Prisma.ProdutoWhereInput = search ? {
      OR: [
        { nome: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ],
    } : {}
    const where: Prisma.ProdutoWhereInput = { AND: [busca, filtros[filtro]] }
    const [total, produtos, totalCatalogo, faltandoNcm, faltandoGtin,
      faltandoCfop, faltandoCsosn, faltandoPisCofins, incompletos] = await Promise.all([
      db.produto.count({ where }),
      db.produto.findMany({
        where, orderBy: { nome: 'asc' }, skip: (page - 1) * 30, take: 30,
        select: { id: true, nome: true, sku: true, ncm: true, cest: true, cfop: true, origem: true, cst: true, csosn: true, unidadeFiscal: true,
          gtinFiscal: true, pisCst: true, cofinsCst: true, ipiCst: true, ibsCbsCst: true, ibsCbsClassTrib: true },
      }),
      db.produto.count(),
      db.produto.count({ where: vazio('ncm') }),
      db.produto.count({ where: vazio('gtinFiscal') }),
      db.produto.count({ where: vazio('cfop') }),
      db.produto.count({ where: vazio('csosn') }),
      db.produto.count({ where: faltaPisCofins }),
      db.produto.count({ where: pendencia }),
    ])
    const indicadores = {
      total: totalCatalogo,
      ncm: { preenchidos: totalCatalogo - faltandoNcm, faltando: faltandoNcm },
      gtin: { preenchidos: totalCatalogo - faltandoGtin, faltando: faltandoGtin },
      cfop: { preenchidos: totalCatalogo - faltandoCfop, faltando: faltandoCfop },
      csosn: { preenchidos: totalCatalogo - faltandoCsosn, faltando: faltandoCsosn },
      pisCofins: { preenchidos: totalCatalogo - faltandoPisCofins, faltando: faltandoPisCofins },
      completosBasicos: totalCatalogo - incompletos,
      pendentes: incompletos,
    }
    return NextResponse.json({ produtos: produtos.map(p => ({ ...p, pendencias: pendenciasClassificacaoSimples(p) })), total, pagina: page, porPagina: 30, filtro, indicadores }, { headers: { 'Cache-Control': 'private, no-store' } })
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
