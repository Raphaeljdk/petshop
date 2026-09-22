import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { siggma } from '@/lib/siggma/service'
import { SiggmaApiError } from '@/lib/siggma/client'
import { getZettaProduct, syncZettaProductsToLocal, zettaProductSku } from '@/lib/zetta-products'
import { normalizeCpfCnpj } from '@/lib/siggma/customer'

function cents(value: number | null | undefined) {
  return Math.round(Number(value || 0) * 100)
}

function money(valueCents: number) {
  return (valueCents / 100).toFixed(2)
}

function formatDateTime(date: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return [
    date.getUTCFullYear(),
    '-',
    p(date.getUTCMonth() + 1),
    '-',
    p(date.getUTCDate()),
    ' ',
    p(date.getUTCHours()),
    ':',
    p(date.getUTCMinutes()),
    ':',
    p(date.getUTCSeconds()),
  ].join('')
}

export function vendaSiggmaGuid(vendaId: string) {
  const bytes = Buffer.from(createHash('sha256').update(vendaId).digest().subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function vendaSiggmaNumericId(vendaId: string) {
  const hash = createHash('sha256').update(vendaId).digest()
  const value = hash.readUInt32BE(0) & 0x7fffffff
  return value || 1
}

async function resolveCpfCnpj(venda: {
  clienteId: string | null
  cliente: { cpfCnpj: string | null } | null
}) {
  const local = normalizeCpfCnpj(venda.cliente?.cpfCnpj)
  if (local) return local
  if (!venda.clienteId) return ''

  const user = await db.user.findFirst({
    where: { clienteId: venda.clienteId },
    select: { siggmaCliCod: true },
  })

  if (!user?.siggmaCliCod) return ''
  const official = await siggma.clientes.buscar(user.siggmaCliCod)
  return normalizeCpfCnpj(official?.cliDoc || official?.pessoa?.cpfcnpj)
}

export async function importarVendaNoSiggma(vendaId: string) {
  const venda = await db.venda.findUnique({
    where: { id: vendaId },
    include: {
      cliente: true,
      itens: { include: { produto: true } },
    },
  })

  if (!venda) throw new Error('Venda não encontrada para integração com o Siggma.')

  const zettaItems = venda.itens.filter((item) => Boolean(item.produto.zettaProCod))
  if (zettaItems.length === 0) return { imported: false, reason: 'no-siggma-items' as const }
  if (zettaItems.length !== venda.itens.length) {
    throw new Error('Pedido misto não pode ser importado no Siggma.')
  }

  const cpfCnpj = await resolveCpfCnpj(venda)
  if (!cpfCnpj) {
    throw new Error('CPF/CNPJ do cliente é obrigatório para importar o pedido no Siggma.')
  }

  const officialProducts = await Promise.all(
    zettaItems.map((item) => getZettaProduct(item.produto.zettaProCod!))
  )

  const itemTotals = zettaItems.map((item) => cents(item.precoUnit) * item.quantidade)
  const subtotalCents = itemTotals.reduce((acc, value) => acc + value, 0)
  const discountCents = cents(venda.descontoCupom)
  const freightCents = cents(venda.valorFrete)
  const totalCents = subtotalCents - discountCents + freightCents

  const payloadItems = zettaItems.map((item, index) => {
    const official = officialProducts[index]
    const itemTotal = itemTotals[index]
    const discount = index === 0 ? discountCents : 0
    const freight = index === 0 ? freightCents : 0

    return {
      sku: zettaProductSku(official),
      codigoIntegracao: official.codigoIntegracao || undefined,
      descricao: official.nome || item.produto.nome,
      qtd: String(item.quantidade),
      preco: money(cents(item.precoUnit)),
      total: money(itemTotal),
      desconto: money(discount),
      despesas: '0.00',
      valorFrete: money(freight),
      totalGeral: money(itemTotal - discount + freight),
    }
  })

  const guid = vendaSiggmaGuid(venda.id)

  try {
    await siggma.pedidos.importar([
      {
        id: vendaSiggmaNumericId(venda.id),
        dataCriacao: formatDateTime(venda.createdAt),
        guid,
        status: 'novo',
        cpfCnpj,
        nome: venda.cliente?.nome || undefined,
        email: venda.cliente?.email || undefined,
        telefone: normalizeCpfCnpj(venda.cliente?.telefone) || undefined,
        celular: normalizeCpfCnpj(venda.cliente?.telefone) || undefined,
        cep: venda.cepEntrega || venda.cliente?.cep || undefined,
        endereco: venda.enderecoEntrega || venda.cliente?.endereco || undefined,
        valorFrete: money(freightCents),
        totalProduto: money(subtotalCents),
        desconto: money(discountCents),
        despesas: '0.00',
        totalGeral: money(totalCents),
        item: payloadItems,
      },
    ])
  } catch (error) {
    if (error instanceof SiggmaApiError) {
      const message = String(error.message || '').toLowerCase()
      if (
        message.includes('guid') &&
        (message.includes('duplic') || message.includes('unic') || message.includes('unique'))
      ) {
        return { imported: true, duplicate: true, guid }
      }
    }
    throw error
  }

  try {
    await syncZettaProductsToLocal()
  } catch (syncError) {
    console.error('[siggma/orders] pedido importado, mas atualização de estoque falhou:', syncError)
  }

  return { imported: true, duplicate: false, guid }
}
