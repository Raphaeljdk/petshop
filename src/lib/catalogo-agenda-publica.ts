import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { catalogoPorRaca, slugServico, listarServicosParaConfiguracao } from '@/lib/catalogo-servicos-matilha'
import { grupoParaRaca } from '@/lib/servicos-grupos-porte'
import { diaSaoPaulo, profissionaisDisponiveis } from '@/lib/agenda-servicos-dia'

import {diaDaSemana,resolverEscala,dentroDoExpediente} from '@/lib/agenda-escala-semanal'
import { horariosDoDia } from '@/lib/agenda-horarios-portal'

async function carregarDia(dia:string,todosServicos:ReturnType<typeof listarServicosParaConfiguracao>, banco:Prisma.TransactionClient=db) {
  const [escala,profissionais,semanal]=await Promise.all([
    banco.agendaServicoDia.findUnique({where:{dia}}),
    banco.profissionalAgenda.findMany({where:{ativo:true},select:{id:true}}),
    banco.agendaEscalaSemanal.findUnique({where:{diaSemana:diaDaSemana(dia)},select:{diaSemana:true,inicio:true,fim:true,servicos:true,turnos:true}}),
  ])
  const efetiva=resolverEscala(dia,escala,semanal)
  if(!efetiva)return null
  const escalaDia=efetiva.servicos
  const ids = [...new Set(escalaDia.flatMap(s => s.profissionais))]
  const inicioDia=new Date(dia+'T00:00:00-03:00')
  const fimMaximo=new Date(inicioDia.getTime()+86400000)
  const bloqueios = await banco.agendaBloqueio.findMany({
    where: { profissionalId: { in: ids }, inicio: { lt: fimMaximo }, fim: { gt: inicioDia } },
    select: { profissionalId: true, inicio: true, fim: true },
  })
  // Os horários em andamento e futuros ocupam toda a duração do serviço, não só o minuto inicial.
  // Registros legados sem duração conhecida são tratados conservadoramente (até 12h).
  const agendados = await banco.agendamento.findMany({
    where:{profissionalId:{in:ids},status:{in:['agendado','confirmado']},dataHora:{gte:new Date(inicioDia.getTime()-1440*60_000),lt:fimMaximo}},
    select:{profissionalId:true,dataHora:true,duracaoMinutos:true,servico:true,pet:{select:{raca:true}}},
  })
  const ocupados=agendados.flatMap(a=>{
    if(!a.profissionalId)return []
    const config=todosServicos.find(s=>slugServico(s.nome)===slugServico(a.servico))
    const grupo=config?grupoParaRaca(config.gruposPorte,a.pet.raca):null
    const minutos=a.duracaoMinutos??grupo?.duracaoMinutos??config?.duracaoMinutos??720
    return [{profissionalId:a.profissionalId,inicio:a.dataHora,fim:new Date(a.dataHora.getTime()+minutos*60_000)}]
  })
  const ativos = new Set(profissionais.map(p => p.id))
  return {escalaDia,efetiva,ativos,intervalos:[...bloqueios,...ocupados]}
}
type ContextoDia=NonNullable<Awaited<ReturnType<typeof carregarDia>>>
function profissionaisDoHorario(ctx:ContextoDia,dia:string,s:{chave:string;duracaoMinutos:number},inicio:Date) {
  const item=ctx.escalaDia.find(e=>e.chave===s.chave)
  const fim=new Date(inicio.getTime()+s.duracaoMinutos*60000)
  return item&&diaSaoPaulo(inicio)===dia&&diaSaoPaulo(new Date(fim.getTime()-1))===dia?profissionaisDisponiveis(item.profissionais,ctx.ativos,ctx.intervalos,inicio,fim).filter(id=>dentroDoExpediente(dia,inicio,fim,id,ctx.efetiva)):[]
}
function servicoDisponivel(ctx:ContextoDia,dia:string,s:{chave:string;duracaoMinutos:number},inicio:Date){return profissionaisDoHorario(ctx,dia,s,inicio).length>0
}

export async function consultarCatalogoPublico(raca: string | null, desiredAt?: Date) {
  const configs=await db.servicoEsteticoConfig.findMany()
  const {todos:todosServicos,opcoes:porRaca,pendentes}=catalogoPorRaca(configs,raca)
  const base={opcoes:porRaca,pendentes}
  if (!porRaca.length) return {...base,motivo:!raca?.trim()?'raca-nao-cadastrada':pendentes.length?'servicos-pendentes':'raca-nao-cadastrada',servicos:[] as typeof porRaca}
  if (!desiredAt) return {...base,motivo:'escolher-horario',servicos:[] as typeof porRaca}
  const dia=diaSaoPaulo(desiredAt)
  const ctx=await carregarDia(dia,todosServicos)
  if(!ctx)return {...base,motivo:'dia-sem-escala',servicos:[] as typeof porRaca}
  const servicos=porRaca.filter(s=>servicoDisponivel(ctx,dia,s,desiredAt))
  // A lista não constitui uma reserva; a equipe confirma a capacidade da agenda.
  return { ...base, motivo: servicos.length ? null : 'sem-servicos-disponiveis', servicos }
}

/** Consulta somente leitura: uma carga da escala e dos bloqueios por dia. Não reserva horário. */
export async function consultarHorariosPublicos(raca:string|null,dia:string,chave:string) {
  const configs=await db.servicoEsteticoConfig.findMany()
  const {todos,opcoes}=catalogoPorRaca(configs,raca)
  const servico=opcoes.find(s=>s.chave===chave)
  if(!servico)return {horarios:[],motivo:'servico-indisponivel'}
  const horarios=horariosDoDia(dia)
  if(!horarios.length)return {horarios:[],motivo:'dia-fora-do-limite'}
  const ctx=await carregarDia(dia,todos)
  if(!ctx)return {horarios:[],motivo:'dia-sem-escala'}
  const equipe=ctx.escalaDia.find(s=>s.chave===chave)?.profissionais.filter(id=>ctx.ativos.has(id))??[]
  if(!equipe.length)return {horarios:[],motivo:'sem-profissional-servico'}
  const disponiveis=horarios.filter(h=>servicoDisponivel(ctx,dia,servico,new Date(dia+'T'+h+':00-03:00')))
  return {horarios:disponiveis,motivo:disponiveis.length?null:'sem-horarios'}
}

/** Chamado dentro da mesma transação da reserva. Não confia no horário exibido pelo navegador. */
export async function selecionarReservaAutomatica(tx:Prisma.TransactionClient,raca:string|null,servicoNome:string,inicio:Date){
 const configs=await tx.servicoEsteticoConfig.findMany()
 const {todos,opcoes}=catalogoPorRaca(configs,raca)
 const servico=opcoes.find(s=>s.nome===servicoNome)
 if(!servico)return null
 const dia=diaSaoPaulo(inicio)
 const ctx=await carregarDia(dia,todos,tx)
 if(!ctx)return null
 const ids=profissionaisDoHorario(ctx,dia,servico,inicio)
 if(!ids.length)return null
 const carga=(id:string)=>ctx.intervalos.filter(x=>x.profissionalId===id).length
 const profissionalId=ids.sort((a,b)=>carga(a)-carga(b)||a.localeCompare(b))[0]
 return {servico,profissionalId}
}
