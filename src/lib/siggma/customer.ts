import { db } from '@/lib/db'
import { siggma } from '@/lib/siggma/service'

export function normalizeCpfCnpj(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '')
}

function allEqual(value: string) {
  return /^([0-9])\1+$/.test(value)
}

function validCpf(value: string) {
  if (!/^\d{11}$/.test(value) || allEqual(value)) return false
  const calc = (length: number) => {
    let sum = 0
    for (let i = 0; i < length; i += 1) sum += Number(value[i]) * (length + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return calc(9) === Number(value[9]) && calc(10) === Number(value[10])
}

function validCnpj(value: string) {
  if (!/^\d{14}$/.test(value) || allEqual(value)) return false
  const digit = (length: 12 | 13) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((acc, weight, index) => acc + Number(value[index]) * weight, 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  return digit(12) === Number(value[12]) && digit(13) === Number(value[13])
}

export function validCpfCnpj(value: string | null | undefined) {
  const normalized = normalizeCpfCnpj(value)
  return normalized.length === 11 ? validCpf(normalized) : validCnpj(normalized)
}

export async function findOrImportSiggmaClient(input: {
  cpfCnpj: string
  nome: string
  email?: string | null
  telefone?: string | null
  endereco?: string | null
  cep?: string | null
}) {
  const cpfCnpj = normalizeCpfCnpj(input.cpfCnpj)
  if (!validCpfCnpj(cpfCnpj)) throw new Error('CPF/CNPJ inválido.')

  const existing = await siggma.clientes.listar({
    pagina: 1,
    limit: 20,
    cpfcnpj: cpfCnpj,
  })

  const match = (existing.data || []).find((client) => {
    const document = normalizeCpfCnpj(client.cliDoc || client.pessoa?.cpfcnpj)
    return document === cpfCnpj
  })

  if (match?.cliCod) return match.cliCod

  const imported = await siggma.clientes.importar([
    {
      cliDoc: cpfCnpj,
      consumidorFinal: true,
      cliObs: 'Cliente criado pelo Hub Matilha Prado',
      pessoa: {
        tipo: cpfCnpj.length === 11 ? 'F' : 'J',
        nome: input.nome,
        email: input.email || undefined,
        celular: normalizeCpfCnpj(input.telefone) || undefined,
        telefone: normalizeCpfCnpj(input.telefone) || undefined,
        endereco: input.endereco || undefined,
        cep: normalizeCpfCnpj(input.cep) || undefined,
      },
    },
  ])

  const item = imported.data?.[0]
  if (item?.erro) throw new Error(item.erro)
  if (!item?.cliente) throw new Error('O Siggma não retornou o código do cliente criado.')
  return item.cliente
}

export async function ensurePortalUserSiggmaLink(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { cliente: true },
  })

  if (!user || user.role !== 'CLIENTE' || !user.cliente) return null
  if (user.siggmaCliCod) return user.siggmaCliCod
  if (!user.cliente.cpfCnpj) return null

  const cliCod = await findOrImportSiggmaClient({
    cpfCnpj: user.cliente.cpfCnpj,
    nome: user.cliente.nome,
    email: user.cliente.email,
    telefone: user.cliente.telefone,
    endereco: user.cliente.endereco,
    cep: user.cliente.cep,
  })

  await db.user.update({
    where: { id: user.id },
    data: { siggmaCliCod: cliCod },
  })

  return cliCod
}
