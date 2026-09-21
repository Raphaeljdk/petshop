import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'
import { CupomValidationError, validarCupom } from '@/lib/cupons'

const schema = z
  .object({
    codigo: z.string().trim().min(3).max(30),
    subtotal: z.number().finite().positive(),
  })
  .strict()

export async function POST(req: NextRequest) {
  try {
    const cliente = await getClienteLogado()
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Informe um cupom e um subtotal válidos.' }, { status: 400 })
    }

    const resultado = await validarCupom(db, {
      codigo: parsed.data.codigo,
      subtotal: parsed.data.subtotal,
      clienteId: cliente.id,
    })

    return NextResponse.json({
      cupom: {
        codigo: resultado.codigo,
        descricao: resultado.cupom.descricao,
        tipoDesconto: resultado.cupom.tipoDesconto,
        valor: resultado.cupom.valor,
        desconto: resultado.desconto,
        influenciadorNome: resultado.cupom.influenciadorNome,
      },
      subtotal: parsed.data.subtotal,
      totalProdutos: resultado.valorProdutosLiquido,
    })
  } catch (error) {
    if (error instanceof CupomValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('cupons/validar POST erro:', error)
    return NextResponse.json({ error: 'Não foi possível validar o cupom.' }, { status: 500 })
  }
}
