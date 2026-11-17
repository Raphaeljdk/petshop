export const requiresFichaAtendimento=(servico:string)=>{
 const value=servico.trim().toLocaleLowerCase('pt-BR')
 return /banho|tosa|spa|hidrata[cç][aã]o|desembolo|trimming|escova[cç][aã]o/.test(value)
}
export function canAdvanceServiceProcess(args:{
 requiresFicha:boolean;status:'em_andamento'|'finalizado';checkinStatus?:string|null;checkoutCompleted?:boolean
}):string|null{
 if(!args.requiresFicha)return null
 if(args.checkinStatus!=='aceito')return 'O check-in precisa ser autorizado pelo tutor na aba Meus Pets antes de iniciar ou concluir o atendimento.'
 if(args.status==='finalizado'&&!args.checkoutCompleted)return 'Conclua a ficha de check-out antes de finalizar o atendimento.'
 return null
}

/** Um aceite não substitui avaliação veterinária nem libera serviço suspenso. */
export function unsafeCheckin(checkin:unknown):boolean{
 if(!checkin||typeof checkin!=='object'||Array.isArray(checkin))return false
 const data=checkin as Record<string,unknown>
 return data.chegadaCondicao==='Necessita avaliação veterinária antes do procedimento'||
  (Array.isArray(data.checkinComunicacoes)&&data.checkinComunicacoes.includes('Procedimento suspenso/não iniciado por segurança'))
}
