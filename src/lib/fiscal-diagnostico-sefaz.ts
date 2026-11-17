/** Resultado seguro do NFeStatusServico4 (não representa autorização de NF-e). */
export type DiagnosticoConsultaSefaz={
 mensagem:string
 codigoTecnico:string|null
 codigoSefaz:number|null
 categoria:string
 ok:boolean
}
export function mapearConsultaSefaz(resultado:Record<string,unknown>,httpOk:boolean):DiagnosticoConsultaSefaz{
 const codigoTecnico=typeof resultado.codigoTecnico==='string'&&
  /^[A-Z0-9_]{2,75}$/.test(resultado.codigoTecnico)?resultado.codigoTecnico:null
 const codigoSefaz=typeof resultado.codigo==='number'&&Number.isInteger(resultado.codigo)&&
  resultado.codigo>=100&&resultado.codigo<=999?resultado.codigo:null
 const categoria=typeof resultado.categoria==='string'&&
  /^[a-z-]{2,50}$/.test(resultado.categoria)?resultado.categoria:'consulta'
 const mensagem=[resultado.error,resultado.aviso,resultado.motivo]
  .find((v):v is string=>typeof v==='string'&&v.trim().length>0)||'Consulta concluída.'
 return {mensagem,codigoTecnico,codigoSefaz,categoria,ok:httpOk&&resultado.ok===true}
}
