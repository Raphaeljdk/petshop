/** Pré-requisitos da emissão real; não transmite documentos. */
export type LiberacaoReal = {serie:number; primeiroNumero:number; referenciaNumeracao:string; referenciaContabil:string; referenciaSchema:string; exclusivo:boolean}
export function validarLiberacaoReal(config:LiberacaoReal, habilitado:boolean){
 if(!habilitado)throw new Error('Emissão real desativada.')
 if(config.serie!==2||!Number.isSafeInteger(config.primeiroNumero)||config.primeiroNumero<1||config.primeiroNumero>999999999||!config.exclusivo||
 ![config.referenciaNumeracao,config.referenciaContabil,config.referenciaSchema].every(v=>v.trim().length>=5))
 throw new Error('Liberação fiscal incompleta.')
 return config
}
export function interpretarEstadoReal(chave:string, retorno:{ambiente:number;chave:string;codigo:number;protocolo?:string|null;recibo?:string|null}){
 if(!/^\d{44}$/.test(chave)||retorno.ambiente!==1||retorno.chave!==chave||!Number.isInteger(retorno.codigo)||retorno.codigo<100||retorno.codigo>999)throw new Error('Retorno incompatível.')
 if([100,150].includes(retorno.codigo)){
 if(!/^\d{15}$/.test(retorno.protocolo||''))throw new Error('Protocolo inválido.')
 return 'autorizada' as const
 }
 if([103,105].includes(retorno.codigo)&&/^\d{15}$/.test(retorno.recibo||''))return 'recebida' as const
 return 'incerta' as const
}
