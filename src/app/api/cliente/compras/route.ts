import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClienteLogado } from '@/lib/auth-helpers'
import { siggma } from '@/lib/siggma/service'
import { vendaSiggmaGuid } from '@/lib/siggma/orders'

export async function GET() {
  try {
    const cliente = await getClienteLogado()
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não autenticado' }, { status: 401 })
    }

    const vendas = await db.venda.findMany({
      where: { clienteId: cliente.id },
      orderBy: { createdAt: 'desc' },
      include: { itens: { include: { produto: true } } },
    })

    const siggmaSales = vendas
      .filter((venda) => venda.itens.some((item) => Boolean(item.produto.zettaProCod)))
      .slice(0, 100)

    const guidByVenda = new Map(
      siggmaSales.map((venda) => [venda.id, vendaSiggmaGuid(venda.id)])
    )

    const fiscalByGuid = new Map<string, string>()
    if (siggmaSales.length > 0) {
      try {
        const response = await siggma.notas.status([...guidByVenda.values()])
        for (const item of response.data || []) {
          fiscalByGuid.set(item.guid, item.status)
        }
      } catch (error) {
        console.error('[cliente/compras] status fiscal Siggma indisponível:', error)
      }
    }

    return NextResponse.json(
      vendas.map((venda) => {
        const guid = guidByVenda.get(venda.id) || null
        return {
          ...venda,
          siggmaGuid: guid,
          statusFiscal: guid ? fiscalByGuid.get(guid) || 'EXCLUIDO' : null,
        }
      })
    )
  } catch (e) {
    console.error('cliente/compras GET erro:', e)
    return NextResponse.json({ error: 'Erro ao listar compras' }, { status: 500 })
  }
}
