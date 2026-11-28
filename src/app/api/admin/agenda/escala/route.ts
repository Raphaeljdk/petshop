import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { assertSameOrigin } from '@/lib/auth-http'
import { listarServicosParaConfiguracao } from '@/lib/catalogo-servicos-matilha'
import { diaAgendaSchema, servicosDiaSchema } from '@/lib/agenda-servicos-dia'

import {diaDaSemana,resolverEscala} from '@/lib/agenda-escala-semanal'

export const dynamic = 'force-dynamic'

async function autorizar() {
  const user = await getUsuarioLogado()
  if (!user) return { user: null, denied: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) }
  if (user.role !== 'ADMIN') return { user: null, denied: NextResponse.json({ error: 'Acesso negado.' }, { status: 403 }) }
  return { user, denied: null }
}
function erro(e: unknown) {
  if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0]?.message || 'Dados inválidos.' }, { status: 400 })
  console.error('escala de serviços', e)
  return NextResponse.json({ error: 'Não foi possível processar a escala.' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const { denied } = await autorizar()
  if (denied) return denied
  try {
    const dia = diaAgendaSchema.parse(req.nextUrl.searchParams.get('dia'))
    const [registro, configuracoes, equipe,semanal] = await Promise.all([
      db.agendaServicoDia.findUnique({ where: { dia } }),
      db.servicoEsteticoConfig.findMany(),
      db.profissionalAgenda.findMany({ orderBy: { nome: 'asc' }, select: { id: true, nome: true, ativo: true, especialidades: true } }),
      db.agendaEscalaSemanal.findUnique({where:{diaSemana:diaDaSemana(dia)},select:{diaSemana:true,inicio:true,fim:true,servicos:true,turnos:true}}),
    ])
    return NextResponse.json({
      dia, configurado: !!registro||!!semanal, excecao:!!registro, recorrente:!!semanal, escala: resolverEscala(dia,registro,semanal)?.servicos??[],
      servicos: listarServicosParaConfiguracao(configuracoes).map(s => ({ chave: s.chave, nome: s.nome, confirmado: s.gruposConfirmados })),
      equipe,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) { return erro(e) }
}
export async function PUT(req: NextRequest) {
  const { user, denied } = await autorizar()
  if (denied || !user) return denied
  try {
    assertSameOrigin(req)
    const { dia, servicos } = z.object({ dia: diaAgendaSchema, servicos: servicosDiaSchema }).strict().parse(await req.json())
    const [configs, equipe] = await Promise.all([
      db.servicoEsteticoConfig.findMany(),
      db.profissionalAgenda.findMany({ where: { ativo: true }, select: { id: true } }),
    ])
    const chaves = new Set(listarServicosParaConfiguracao(configs).map(s => s.chave))
    const ativos = new Set(equipe.map(p => p.id))
    if (servicos.some(s => !chaves.has(s.chave) || s.profissionais.some(id => !ativos.has(id))))
      return NextResponse.json({ error: 'Selecione serviços cadastrados e profissionais ativos.' }, { status: 409 })
    await db.agendaServicoDia.upsert({
      where: { dia }, create: { dia, servicos, atualizadoPorId: user.id },
      update: { servicos, atualizadoPorId: user.id },
    })
    return NextResponse.json({ ok: true, dia })
  } catch (e) { return erro(e) }
}

export async function DELETE(req:NextRequest){
 const {denied}=await autorizar()
 if(denied)return denied
 try{assertSameOrigin(req);const dia=diaAgendaSchema.parse(req.nextUrl.searchParams.get('dia'));await db.agendaServicoDia.deleteMany({where:{dia}});return NextResponse.json({ok:true})}catch(e){return erro(e)}
}
