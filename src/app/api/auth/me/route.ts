// GET /api/auth/me - retorna dados do usuário logado (lê cookie HTTP-only)
import { authJson } from '@/lib/auth-http'
import { getUsuarioLogado } from '@/lib/auth-cookies'
import { db } from '@/lib/db'

interface ClienteInfo {
  id: string
  nome: string
  telefone: string
  email: string | null
  endereco: string | null
  cep: string | null
  pets?: unknown[]
}

export async function GET() {
  try {
    const user = await getUsuarioLogado()

    if (!user) {
      return authJson({ autenticado: false })
    }

    // Buscar pets do cliente se for CLIENTE
    let clienteCompleto: ClienteInfo | null = null
    if (user.role === 'CLIENTE' && user.cliente) {
      const clienteComPets = await db.cliente.findUnique({
        where: { id: user.cliente.id },
        include: { pets: true },
      })
      if (clienteComPets) {
        clienteCompleto = {
          id: clienteComPets.id,
          nome: clienteComPets.nome,
          telefone: clienteComPets.telefone,
          email: clienteComPets.email,
          endereco: clienteComPets.endereco,
          cep: clienteComPets.cep,
          pets: clienteComPets.pets,
        }
      }
    } else if (user.cliente) {
      clienteCompleto = {
        id: user.cliente.id,
        nome: user.cliente.nome,
        telefone: user.cliente.telefone,
        email: user.cliente.email,
        endereco: user.cliente.endereco,
        cep: user.cliente.cep,
      }
    }

    return authJson({
      autenticado: true,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        clienteId: user.clienteId,
        cliente: clienteCompleto,
      },
      cliente: clienteCompleto,
    })
  } catch (e) {
    console.error('me erro:', e)
    return authJson({ autenticado: false })
  }
}
