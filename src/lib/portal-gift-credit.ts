import type { Prisma } from '@prisma/client'

export class GiftCreditError extends Error {
  constructor(message:string,public status=409){super(message)}
}
type GiftDb = Pick<Prisma.TransactionClient,'portalGiftRequest'|'portalGiftRedemption'|'venda'>
export function moneyCents(n:number) { return Math.round(n*100) }
export function giftCode(raw:string) {return raw.trim().toUpperCase()}
export async function quoteGiftCredit(db:GiftDb,code:string,clienteId:string,clientEmail:string,totalCents:number) {
  const voucher=await db.portalGiftRequest.findUnique({where:{voucherCode:giftCode(code)}})
  if(!voucher||voucher.status!=='pago'||!voucher.paidAt||voucher.balanceCents<=0)
    throw new GiftCreditError('Vale-presente inválido ou sem saldo disponível.')
  if(voucher.recipientEmail && voucher.recipientEmail.toLowerCase()!==clientEmail.toLowerCase())
    throw new GiftCreditError('Este vale-presente pertence a outra conta.',403)
  if(!Number.isSafeInteger(totalCents)||totalCents<1)throw new GiftCreditError('Valor de compra inválido.')
  return {id:voucher.id,availableCents:voucher.balanceCents,
    appliedCents:Math.min(voucher.balanceCents,totalCents)}
}
export async function reserveGiftCredit(tx:Prisma.TransactionClient,code:string,clienteId:string,email:string,
    totalCents:number,saleId:string) {
  // Serialize redemption across different customers using the same bearer code.
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))','gift:'+giftCode(code))
  const quote=await quoteGiftCredit(tx,code,clienteId,email,totalCents)
  const gift=await tx.portalGiftRequest.update({
    where:{id:quote.id},data:{balanceCents:{decrement:quote.appliedCents}},
  })
  if(gift.balanceCents<0)throw new GiftCreditError('O saldo do vale não está disponível.',409)
  await tx.portalGiftRedemption.create({data:{
    giftId:quote.id,saleId,amountCents:quote.appliedCents,
    status:quote.appliedCents===totalCents?'consumido':'reservado',
  }})
  return quote.appliedCents
}
export async function updateGiftRedemption(tx:Prisma.TransactionClient,saleId:string,
  result:'concluida'|'cancelada') {
  const row=await tx.portalGiftRedemption.findUnique({where:{saleId}})
  if(!row || row.status!=='reservado')return
  if(result==='concluida') {
    await tx.portalGiftRedemption.update({where:{id:row.id},data:{status:'consumido'}})
    return
  }
  const changed=await tx.portalGiftRedemption.updateMany({where:{id:row.id,status:'reservado'},
    data:{status:'liberado'}})
  if(changed.count) await tx.portalGiftRequest.update({where:{id:row.giftId},
    data:{balanceCents:{increment:row.amountCents}}})
}
