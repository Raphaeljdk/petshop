/** Prefixos oficiais de município IBGE por UF. Valida coerência, não existência do município. */
export const PREFIXO_IBGE_UF = {
 AC:'12',AL:'27',AP:'16',AM:'13',BA:'29',CE:'23',DF:'53',ES:'32',GO:'52',MA:'21',
 MT:'51',MS:'50',MG:'31',PA:'15',PB:'25',PR:'41',PE:'26',PI:'22',RJ:'33',RN:'24',
 RS:'43',RO:'11',RR:'14',SC:'42',SP:'35',SE:'28',TO:'17',
} as const
export function municipioCoerenteComUf(uf:string,codigo:string){
 return Object.prototype.hasOwnProperty.call(PREFIXO_IBGE_UF,uf) &&
 /^\d{7}$/.test(codigo) && codigo.startsWith(PREFIXO_IBGE_UF[uf as keyof typeof PREFIXO_IBGE_UF])
}
/** Revenda de terceiros a consumidor final não contribuinte (indIEDest=9). Não converte operações especiais nem habilita contribuintes. */
export function cfopRevendaPorDestino(cfop:string,uf:string){
 if(!Object.prototype.hasOwnProperty.call(PREFIXO_IBGE_UF,uf))throw new Error('UF de destino inválida.')
 if(['5102','6102','6108'].includes(cfop))return uf==='SP'?'5102':'6108'
 if(uf==='SP'&&/^5\d{3}$/.test(cfop))return cfop
 throw new Error('CFOP interestadual não suportado. Exige regra fiscal específica.')
}
