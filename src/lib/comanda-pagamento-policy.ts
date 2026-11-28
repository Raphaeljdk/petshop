export type VendaComandaPagamento={total:number;status:string;mercadoPagoStatus?:string|null;mercadoPagoId?:string|null}
export function pagamentoRealAprovado(venda:VendaComandaPagamento|null|undefined,centavos:number):boolean {
 return !!venda&&venda.status==='concluida'&&venda.mercadoPagoStatus==='approved'&&!!venda.mercadoPagoId&&!/^SIM[-_]/i.test(venda.mercadoPagoId)&&Math.round(venda.total*100)===centavos
}
export function adicionalLiberado(extra:{status:string;precoCentavos:number;aceitoPorId?:string|null;equipePorId?:string|null;venda?:VendaComandaPagamento|null}):boolean{
 return extra.status==='autorizado'&&!!extra.aceitoPorId&&!!extra.equipePorId&&(extra.precoCentavos===0||pagamentoRealAprovado(extra.venda,extra.precoCentavos))
}
export function adicionalFinanceiramentePendente(extra:{status:string;precoCentavos:number;venda?:VendaComandaPagamento|null}):boolean{
 return ['autorizado','realizado'].includes(extra.status)&&extra.precoCentavos>0&&!pagamentoRealAprovado(extra.venda,extra.precoCentavos)
}
