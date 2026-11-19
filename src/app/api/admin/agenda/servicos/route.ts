import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { precosPorRacaSchema } from '@/lib/precos-por-raca'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import {
  CATALOGO_ESTETICO_MATILHA,
  PREFIXO_SERVICO_PERSONALIZADO,
  chaveServicoPersonalizado,
  configuracaoPodeSerConfirmada,
  listarServicosParaConfiguracao,
} from '@/lib/catalogo-servicos-matilha'

export const dynamic = 'force-dynamic'

const campos = z.object({
  chave: z.string().trim().min(2).max(100),
  precoCentavos: z.number().int().min(0).max(10_000_000).nullable(),
  precosPorRaca: precosPorRacaSchema,
  duracaoMinutos: z.number().int().min(5).max(720).nullable(),
  regrasPreco: z.string().trim().max(2000).nullable(),
  observacoes: z.string().trim().max(1000).nullable(),
  confirmado: z.boolean(),
}).strict()

const novoServico = z.object({ nome: z.string().trim().min(2).max(80) }).strict()

async function exigirAdmin() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  return null
}

function erro(error: unknown) {
  if (error instanceof z.ZodError)
    return NextResponse.json({ error: error.issues[0]?.message || 'Configuração inválida.' }, { status: 400 })
  if ((error as { code?: string })?.code === 'P2002')
    return NextResponse.json({ error: 'Já existe um serviço com esse nome.' }, { status: 409 })
  console.error('configuracao servicos esteticos:', error)
  return NextResponse.json({ error: 'Não foi possível processar a configuração dos serviços.' }, { status: 500 })
}

export async function GET() {
  const denied = await exigirAdmin()
  if (denied) return denied
  try {
    const rows = await db.servicoEsteticoConfig.findMany({
      select: {
        chave: true, nome: true, precoCentavos: true, precosPorRaca: true, duracaoMinutos: true,
        regrasPreco: true, observacoes: true, confirmado: true, updatedAt: true,
      },
    })
    return NextResponse.json({ items: listarServicosParaConfiguracao(rows) }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) { return erro(error) }
}

export async function POST(req: NextRequest) {
  const denied = await exigirAdmin()
  if (denied) return denied
  try {
    assertSameOrigin(req)
    const { nome } = novoServico.parse(await req.json())
    const chave = chaveServicoPersonalizado(nome)
    if (!chave) return NextResponse.json({ error: 'Informe um nome com letras ou números.' }, { status: 400 })
    const duplicadoCatalogo = CATALOGO_ESTETICO_MATILHA.some((item) =>
      chaveServicoPersonalizado(item.nome) === chave)
    if (duplicadoCatalogo || await db.servicoEsteticoConfig.findUnique({ where: { chave }, select: { chave: true } }))
      return NextResponse.json({ error: 'Já existe um serviço com esse nome.' }, { status: 409 })
    const registro = await db.servicoEsteticoConfig.create({ data: { chave, nome } })
    const item = listarServicosParaConfiguracao([registro]).find((servico) => servico.chave === chave)
    return NextResponse.json({ item }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return erro(error) }
}

export async function PUT(req: NextRequest) {
  const denied = await exigirAdmin()
  if (denied) return denied
  try {
    assertSameOrigin(req)
    const entrada = campos.parse(await req.json())
    const predefinido = CATALOGO_ESTETICO_MATILHA.some((s) => s.chave === entrada.chave)
    if (!predefinido) {
      if (!entrada.chave.startsWith(PREFIXO_SERVICO_PERSONALIZADO))
        return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 })
      const existe = await db.servicoEsteticoConfig.findUnique({
        where: { chave: entrada.chave }, select: { nome: true },
      })
      if (!existe?.nome) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 })
    }
    if (entrada.confirmado && !configuracaoPodeSerConfirmada(entrada))
      return NextResponse.json({
        error: 'Para confirmar o serviço, informe a duração e um preço de referência, um preço por raça ou as regras de cobrança.',
      }, { status: 400 })
    const { chave, ...data } = entrada
    const registro = await db.servicoEsteticoConfig.upsert({
      where: { chave },
      create: { chave, ...data },
      update: data,
    })
    const item = listarServicosParaConfiguracao([registro])
      .find((servico) => servico.chave === chave)
    return NextResponse.json({ item }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return erro(error) }
}
