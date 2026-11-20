import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { precosPorRacaSchema } from '@/lib/precos-por-raca'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import {
  CATALOGO_ESTETICO_MATILHA,
  chaveServicoPersonalizado,
  slugServico,
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

async function exigirAdmin() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  return null
}

function erro(error: unknown) {
  if (error instanceof z.ZodError)
    return NextResponse.json({ error: error.issues[0]?.message || 'Configuração inválida.' }, { status: 400 })
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

const novoServicoSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do serviço.').max(80, 'Use até 80 caracteres.'),
}).strict()

// Apenas a administração cria serviços; não habilita automaticamente reservas públicas.
export async function POST(req: NextRequest) {
  const denied = await exigirAdmin()
  if (denied) return denied
  try {
    assertSameOrigin(req)
    const { nome } = novoServicoSchema.parse(await req.json())
    const chave = chaveServicoPersonalizado(nome)
    if (chave === 'personalizado-' || chave.length > 100) {
      return NextResponse.json({ error: 'Informe um nome de serviço válido.' }, { status: 400 })
    }
    if (CATALOGO_ESTETICO_MATILHA.some(servico => slugServico(servico.nome) === slugServico(nome))) {
      return NextResponse.json({ error: 'Esse serviço já existe no catálogo padrão.' }, { status: 409 })
    }
    const jaExiste = await db.servicoEsteticoConfig.findUnique({ where: { chave }, select: { chave: true } })
    if (jaExiste) return NextResponse.json({ error: 'Já existe um serviço com esse nome.' }, { status: 409 })
    const registro = await db.servicoEsteticoConfig.create({
      data: { chave, nome, confirmado: false },
    })
    const item = listarServicosParaConfiguracao([registro]).find(servico => servico.chave === chave)
    return NextResponse.json({ item }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um serviço com esse nome.' }, { status: 409 })
    }
    return erro(error)
  }
}

export async function PUT(req: NextRequest) {
  const denied = await exigirAdmin()
  if (denied) return denied
  try {
    assertSameOrigin(req)
    const entrada = campos.parse(await req.json())
    const padrao = CATALOGO_ESTETICO_MATILHA.some(servico => servico.chave === entrada.chave)
    if (!padrao) {
      // Uma chave arbitrária enviada pelo navegador não autoriza criar registro.
      if (!entrada.chave.startsWith('personalizado-') ||
          !(await db.servicoEsteticoConfig.findUnique({ where: { chave: entrada.chave }, select: { nome: true } }))?.nome) {
        return NextResponse.json({ error: 'Serviço não cadastrado. Use Novo serviço antes de configurar.' }, { status: 400 })
      }
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
