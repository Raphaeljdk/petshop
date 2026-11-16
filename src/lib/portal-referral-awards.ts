import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

// Reward is defined by the client in the existing Relacionamento admin section.
// Nothing is awarded before an eligible, actually paid purchase.
export async function awardReferralForPaidSale(tx:Prisma.TransactionClient,saleId:string) {
  const sale=await tx.venda.findUnique({where:{id:saleId},select:{
    id:true,clienteId:true,total:true,status:true,createdAt:true,
  }})
  if(!sale||sale.status!=='concluida'||!sale.clienteId)return {awarded:false}
  const claim=await tx.portalReferralClaim.findUnique({where:{invitedId:sale.clienteId}})
  if(!claim || claim.status!=='aguardando_compra' || sale.createdAt<claim.createdAt)
    return {awarded:false}
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))','referral:'+claim.id)
  const config=await tx.portalReferralConfig.findUnique({where:{id:'default'}})
  if(!config?.active || config.awardCents<=0)return {awarded:false,notConfigured:true}
  if(Math.round(sale.total*100)<config.minimumPurchaseCents)return {awarded:false,minimumNotMet:true}
  const older=await tx.venda.count({where:{
    clienteId:sale.clienteId,status:'concluida',createdAt:{lt:sale.createdAt},
  }})
  if(older)return {awarded:false,alreadyCustomer:true}
  const updated=await tx.portalReferralClaim.updateMany({where:{
    id:claim.id,status:'aguardando_compra',
  },data:{status:'processando_beneficio'}})
  if(!updated.count)return {awarded:false}
  const code='INDIQUE-'+randomBytes(9).toString('hex').toUpperCase()
  const end=new Date(Date.now()+config.validDays*86400000)
  const coupon=await tx.cupom.create({data:{
    codigo:code,descricao:'Benefício individual de indicação Matilha Prado',
    tipoDesconto:'fixo',valor:config.awardCents/100,valorMinimo:0,
    limiteUsos:1,limitePorCliente:1,ativo:true,fimEm:end,
    influenciadorNome:null,comissaoPercentual:0,
  }})
  await tx.portalReferralClaim.update({where:{id:claim.id},data:{
    rewardCouponId:coupon.id,status:'beneficio_emitido',verifiedAt:new Date(),
  }})
  return {awarded:true,couponId:coupon.id}
}
export async function awardReferralBySale(saleId:string) {
  return db.$transaction((tx)=>awardReferralForPaidSale(tx,saleId),
    {isolationLevel:'Serializable'})
}
