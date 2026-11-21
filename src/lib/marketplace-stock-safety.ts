/**
 * Trava emergencial para evitar envio de quantidades não conferidas a ML/Amazon.
 * A configuração é intencionalmente opt-in e não pode ser contornada com "force".
 */
export function stockWritesEnabled(value: string | undefined = process.env.MARKETPLACE_STOCK_WRITES_ENABLED) {
  return value === 'true'
}
