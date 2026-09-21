import type { Cupom, Prisma } from '@prisma/client'

export type CupomDb = Pick<Prisma.TransactionClient, 'cupom' | 'cupomUso'>

export class CupomValidationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message)
    this.name = 'CupomValidationError'
  }
}

export function normalizarCodigoCupom(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/\s+/g, '')
}

export function arredondarMoeda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

export function calcularDescontoCupom(cupom: Pick<Cupom, 'tipoDesconto' | 'valor'>, subtotal: number): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0

  const bruto =
    cupom.tipoDesconto === 'fixo'
      ? cupom.valor
      : subtotal * (cupom.valor / 100)

  return arredondarMoeda(Math.min(subtotal, Math.max(0, bruto)))
}

export function calcularComissaoCupom(valorProdutosLiquido: number, percentual: number): number {
  if (!Number.isFinite(percentual) || percentual <= 0) return 0
  return arredondarMoeda(Math.max(0, valorProdutosLiquido) * (percentual / 100))
}

export async function validarCupom(
  client: CupomDb,
  {
    codigo,
    subtotal,
    clienteId,
  }: {
    codigo: string
    subtotal: number
    clienteId: string
  }
) {
  const codigoNormalizado = normalizarCodigoCupom(codigo)
  if (!codigoNormalizado || codigoNormalizado.length < 3) {
    throw new CupomValidationError('Informe um cupom válido.')
  }

  const cupom = await client.cupom.findUnique({ where: { codigo: codigoNormalizado } })
  if (!cupom) throw new CupomValidationError('Cupom não encontrado.')
  if (!cupom.ativo) throw new CupomValidationError('Este cupom está inativo.')

  const agora = new Date()
  if (cupom.inicioEm && agora < cupom.inicioEm) {
    throw new CupomValidationError('Este cupom ainda não está disponível.')
  }
  if (cupom.fimEm && agora > cupom.fimEm) {
    throw new CupomValidationError('Este cupom expirou.')
  }
  if (subtotal < cupom.valorMinimo) {
    throw new CupomValidationError(
      `Este cupom exige um subtotal mínimo de ${cupom.valorMinimo.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })}.`
    )
  }

  const usoValidoWhere = {
    cupomId: cupom.id,
    venda: { status: 'concluida' },
  } satisfies Prisma.CupomUsoWhereInput

  if (cupom.limiteUsos !== null) {
    const totalUsos = await client.cupomUso.count({ where: usoValidoWhere })
    if (totalUsos >= cupom.limiteUsos) {
      throw new CupomValidationError('O limite de usos deste cupom foi atingido.')
    }
  }

  if (cupom.limitePorCliente > 0) {
    const usosCliente = await client.cupomUso.count({
      where: { ...usoValidoWhere, clienteId },
    })
    if (usosCliente >= cupom.limitePorCliente) {
      throw new CupomValidationError('Você já atingiu o limite de uso deste cupom.')
    }
  }

  const desconto = calcularDescontoCupom(cupom, subtotal)
  if (desconto <= 0) throw new CupomValidationError('Este cupom não gerou desconto para o pedido.')

  return {
    cupom,
    codigo: codigoNormalizado,
    desconto,
    valorProdutosLiquido: arredondarMoeda(subtotal - desconto),
  }
}
