export const INTERVALO_AGENDA_MIN=10
export const LIMITE_AGENDA_DIAS=180
const DIA_MS=86400000
export function diaBrasilia(data:Date):string {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(data)
  const p=(tipo:string)=>parts.find(x=>x.type===tipo)?.value
  return p('year')+'-'+p('month')+'-'+p('day')
}
export function horarioNoIntervalo(data:Date):boolean {
  return Number.isFinite(data.getTime()) && data.getTime()%(INTERVALO_AGENDA_MIN*60000)===0
}
export function horarioSolicitavel(data:Date,agora=new Date()):boolean {
  return horarioNoIntervalo(data)&&data.getTime()>agora.getTime()&&data.getTime()<=agora.getTime()+LIMITE_AGENDA_DIAS*DIA_MS
}
export function horariosDoDia(dia:string,agora=new Date()):string[]{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dia))return []
  const inicio=new Date(dia+'T00:00:00-03:00')
  if(!Number.isFinite(inicio.getTime())||diaBrasilia(inicio)!==dia)return []
  return Array.from({length:144},(_,i)=>{
    const min=i*INTERVALO_AGENDA_MIN
    const hora=String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0')
    return {hora,data:new Date(inicio.getTime()+min*60000)}
  }).filter(s=>horarioSolicitavel(s.data,agora)).map(s=>s.hora)
}
