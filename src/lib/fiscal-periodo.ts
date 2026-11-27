export type PeriodoFiscal='hoje'|'semana'|'mes'|'todas'
export function periodoFiscal(v:string|null):PeriodoFiscal{return v==='hoje'||v==='semana'||v==='mes'?v:'todas'}
export function intervaloFiscal(p:PeriodoFiscal,agora=new Date()){
 if(p==='todas')return undefined
 const local=new Date(agora.getTime()-10800000)
 const gte=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate(),3))
 if(p==='semana')gte.setUTCDate(gte.getUTCDate()-((local.getUTCDay()+6)%7))
 if(p==='mes')gte.setUTCDate(1)
 const lt=new Date(gte)
 if(p==='mes')lt.setUTCMonth(lt.getUTCMonth()+1)
 else lt.setUTCDate(lt.getUTCDate()+(p==='semana'?7:1))
 return {gte,lt}
}
