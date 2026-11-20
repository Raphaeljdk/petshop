import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import { configOnlineValida } from '@/lib/agenda-online'

export const dynamic = 'force-dynamic'

const formulario = z.object({
  enabled: z.boolean(),
  diasSemana: z.array(z.number().int().min(0).max(6)).max(7),
  abre: z.string().max(5),
  fecha: z.string().max(5),
  intervaloMinutos: z.union([z.literal(15), z.literal(30), z.literal(60)]),
}).strict()

async function exigirAdmin() {
  const user = await getUsuarioLogado()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  return null
}
export async function GET() {
  const denied = await exigirAdmin()
  if (denied) return denied
  const config = await db.agendaOnlineConfig.findUnique({ where: { id: 'padrao' } })
  return NextResponse.json({ config: config ?? {
    enabled: false, diasSemana: '', abre: '', fecha: '', intervaloMinutos: 30,
  } }, { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function PUT(request: NextRequest) {
  const denied = await exigirAdmin()
  if (denied) return denied
  try {
    assertSameOrigin(request)
    const entrada = formulario.parse(await request.json())
    const config = {
      enabled: entrada.enabled, diasSemana: [...new Set(entrada.diasSemana)].sort().join(','),
      abre: entrada.abre, fecha: entrada.fecha, intervaloMinutos: entrada.intervaloMinutos,
    }
    if (entrada.enabled && !configOnlineValida(config)) return NextResponse.json({
      error: 'Selecione os dias de atendimento e um horário de abertura/fechamento válido (ao menos 1 hora, até 12 horas).',
    }, { status: 400 })
    const item = await db.agendaOnlineConfig.upsert({
      where: { id: 'padrao' }, create: { id: 'padrao', ...config }, update: config,
    })
    return NextResponse.json({ config: item }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Configuração inválida.' }, { status: 400 })
    console.error('admin agenda online:', error)
    return NextResponse.json({ error: 'Não foi possível salvar os horários online.' }, { status: 500 })
  }
}
