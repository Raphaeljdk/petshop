import {z} from 'zod'
import {servicosDiaSchema,lerServicosDia} from './agenda-servicos-dia'
const hora=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
const turno=z.object({profissionalId:z.string().min(1).max(100),inicio:hora,fim:hora}).strict().refine(t=>t.inicio<t.fim,'O fim deve ser após o início.')
export const turnosSchema=z.array(turno).max(100).superRefine((t,c)=>{
 for(let i=0;i<t.length;i++)for(let j=0;j<i;j++)if(t[i].profissionalId===t[j].profissionalId&&t[i].inicio<t[j].fim&&t[i].fim>t[j].inicio)c.addIssue({code:'custom',message:'Turnos sobrepostos para o mesmo profissional.'})
})
export const escalaSemanalDiaSchema=z.object({diaSemana:z.number().int().min(0).max(6),inicio:hora,fim:hora,servicos:servicosDiaSchema,turnos:turnosSchema}).strict().superRefine((d,c)=>{
 if(d.inicio>=d.fim)c.addIssue({code:'custom',message:'Informe um expediente válido.'})
 if(d.turnos.some(t=>t.inicio<d.inicio||t.fim>d.fim))c.addIssue({code:'custom',message:'Turnos precisam estar dentro do expediente.'})
 if(d.servicos.some(s=>s.profissionais.some(id=>!d.turnos.some(t=>t.profissionalId===id))))c.addIssue({code:'custom',message:'Cada profissional selecionado precisa de um turno.'})
})
export const escalaSemanalSchema=z.array(escalaSemanalDiaSchema).max(7).refine(d=>new Set(d.map(x=>x.diaSemana)).size===d.length,'Dia repetido.')
export type EscalaSemanalDia=z.infer<typeof escalaSemanalDiaSchema>
export function diaDaSemana(dia:string){return new Date(dia+'T12:00:00Z').getUTCDay()}
export function resolverEscala(dia:string,diaria:{servicos:unknown}|null,semanal:unknown){
 const parse=escalaSemanalDiaSchema.safeParse(semanal)
 const base=parse.success?parse.data:null
 if(!base&&!diaria)return null
 const servicos=lerServicosDia(diaria?diaria.servicos:base?.servicos)
 return {servicos,expediente:base?{inicio:base.inicio,fim:base.fim}:null,turnos:base?.turnos??null,dia}
}
export function dentroDoExpediente(dia:string,inicio:Date,fim:Date,id:string,escala:NonNullable<ReturnType<typeof resolverEscala>>){
 const cabe=(i:string,f:string)=>inicio>=new Date(dia+'T'+i+':00-03:00')&&fim<=new Date(dia+'T'+f+':00-03:00')
 if(!escala.expediente)return true // mantém exceções legadas, sem inventar expediente
 return cabe(escala.expediente.inicio,escala.expediente.fim)&&!!escala.turnos?.some(t=>t.profissionalId===id&&cabe(t.inicio,t.fim))
}
