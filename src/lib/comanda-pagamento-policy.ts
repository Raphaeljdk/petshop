export type VendaComandaPagamento={total:number;status:string;mercadoPagoStatus?:string|null;mercadoPagoId?:string|null}
export function pagamentoRealAprovado(venda:VendaComandaPagamento|null|undefined,centavos:number):boolean {
 return !!venda&&venda.status==='concluida'&&venda.mercadoPagoStatus==='approved'&&!!venda.mercadoPagoId&&!/^SIM[-_]/i.test(venda.mercadoPagoId)&&Math.round(venda.total*100)===centavos
}
type ExtraPagamento={status:string;precoCentavos:number;aceitoPorId?:string|null;equipePorId?:string|null;venda?:VendaComandaPagamento|null;grupoVenda?: (VendaComandaPagamento & {comandaExtrasGrupo:{precoCentavos:number}[]})|null}
export function adicionalPago(extra:ExtraPagamento):boolean {
 if(extra.grupoVenda){const valores=extra.grupoVenda.comandaExtrasGrupo;return valores.length>1&&pagamentoRealAprovado(extra.grupoVenda,valores.reduce((s,x)=>s+x.precoCentavos,0))}
 return pagamentoRealAprovado(extra.venda,extra.precoCentavos)
}
export function adicionalLiberado(extra:ExtraPagamento):boolean{
 return extra.status==='autorizado'&&!!extra.aceitoPorId&&!!extra.equipePorId&&(extra.precoCentavos===0||adicionalPago(extra))
}
export function adicionalFinanceiramentePendente(extra:ExtraPagamento):boolean{
 return ['autorizado','realizado'].includes(extra.status)&&extra.precoCentavos>0&&!adicionalPago(extra)
}

export function pendenciasFechamento(args:{principalPago:boolean;checkoutConcluido:boolean;extras:ExtraPagamento[];produtos:VendaComandaPagamento[]}):string[]{
 const p:string[]=[]
 if(!args.principalPago)p.push('Serviço principal sem pagamento conciliado.')
 if(!args.checkoutConcluido)p.push('Conclua a ficha de check-out.')
 if(args.extras.some(x=>['aguardando_tutor','aguardando_equipe'].includes(x.status)))p.push('Existem adicionais aguardando resposta.')
 if(args.extras.some(adicionalFinanceiramentePendente))p.push('Existem adicionais com saldo pendente.')
 if(args.extras.some(x=>x.status==='autorizado'))p.push('Registre a realização dos serviços autorizados.')
 if(args.produtos.some(v=>v.status!=='cancelada'&&!pagamentoRealAprovado(v,Math.round(v.total*100))))p.push('Existem compras de produtos sem pagamento confirmado.')
 return p
}
