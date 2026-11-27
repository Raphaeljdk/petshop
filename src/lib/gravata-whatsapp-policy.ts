type Payment={id:string;status:string;mercadoPagoStatus:string|null;mercadoPagoId:string|null;total:number;clienteId:string|null}
type Booking={clienteId:string;status:string;gravataFoto:string|null;gravataPrecoCentavos:number;servicoPrecoCentavos:number|null;pagamentoVendaId:string|null}
export function gravataPaga(b:Booking,v:Payment|null){
 return Boolean(v&&b.status==='confirmado'&&b.gravataFoto&&b.gravataPrecoCentavos===500&&b.servicoPrecoCentavos!=null&&b.servicoPrecoCentavos>0&&v.id===b.pagamentoVendaId&&v.clienteId===b.clienteId&&v.status==='concluida'&&v.mercadoPagoStatus==='approved'&&v.mercadoPagoId&&!/^SIM[-_]/i.test(v.mercadoPagoId)&&Math.round(v.total*100)===b.servicoPrecoCentavos+500)
}
export function confirmacaoReal(order:{orderId:string;status:string;statusDetail?:string|null;raw?:unknown},v:Payment){
 const raw=order.raw as {external_reference?:unknown;total_amount?:unknown;type?:unknown}|undefined
 return order.orderId===v.mercadoPagoId&&order.status==='processed'&&order.statusDetail==='accredited'&&raw?.external_reference===v.id&&Number.isFinite(Number(raw?.total_amount))&&Math.round(Number(raw?.total_amount)*100)===Math.round(v.total*100)
}
