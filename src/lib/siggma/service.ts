import { siggmaRequest } from '@/lib/siggma/client'
import type {
  SiggmaAnimal,
  SiggmaAtendimento,
  SiggmaCliente,
  SiggmaClienteImportInput,
  SiggmaClienteImportResult,
  SiggmaCategoria,
  SiggmaFiscalStatusResponse,
  SiggmaPage,
  SiggmaPedidoImportInput,
  SiggmaProduto,
  SiggmaVacina,
} from '@/lib/siggma/types'

function queryString(params: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const siggma = {
  clientes: {
    listar(params: { pagina?: number; limit?: number; since?: string; q?: string; cpfcnpj?: string } = {}) {
      return siggmaRequest<SiggmaPage<SiggmaCliente>>(`/api/clientes${queryString(params)}`)
    },
    buscar(id: number) {
      return siggmaRequest<SiggmaCliente | null>(`/api/clientes/${id}`)
    },
    importar(data: SiggmaClienteImportInput[]) {
      return siggmaRequest<SiggmaClienteImportResult>('/api/clientes/importar', {
        method: 'POST',
        body: JSON.stringify({ data }),
      })
    },
  },

  animais: {
    listar(params: { pagina?: number; cliente?: number; since?: string } = {}) {
      return siggmaRequest<SiggmaPage<SiggmaAnimal>>(`/api/animais${queryString(params)}`)
    },
    buscar(id: number) {
      return siggmaRequest<SiggmaAnimal | null>(`/api/animais/${id}`)
    },
  },

  vacinas: {
    listar(params: {
      pagina?: number
      animal?: number
      since?: string
      dataInicial?: string
      dataFinal?: string
    } = {}) {
      return siggmaRequest<SiggmaPage<SiggmaVacina>>(`/api/animais-vacinas${queryString(params)}`)
    },
    buscar(id: number) {
      return siggmaRequest<Record<string, unknown> | null>(`/api/animais-vacinas/${id}`)
    },
  },

  atendimentos: {
    listar(params: {
      pagina?: number
      animal?: number
      cliente?: number
      colaborador?: number
      tipo?: string
      status?: string
      since?: string
      dataInicial?: string
      dataFinal?: string
    } = {}) {
      return siggmaRequest<SiggmaPage<SiggmaAtendimento>>(`/api/animais-historicos${queryString(params)}`)
    },
    buscar(id: number) {
      return siggmaRequest<SiggmaAtendimento | null>(`/api/animais-historicos/${id}`)
    },
  },

  produtos: {
    listar(params: { pagina?: number; codigo?: string; nome?: string; since?: string; ativo?: 'true' | 'false' } = {}) {
      return siggmaRequest<SiggmaPage<SiggmaProduto>>(`/api/itens-integracao${queryString(params)}`)
    },
    buscar(id: number) {
      return siggmaRequest<SiggmaProduto | null>(`/api/itens-integracao/${id}`)
    },
  },

  categorias: {
    listar(params: { pagina?: number; since?: string } = {}) {
      return siggmaRequest<SiggmaPage<SiggmaCategoria>>(`/api/categorias-integracao${queryString(params)}`)
    },
    buscar(id: number) {
      return siggmaRequest<SiggmaCategoria | null>(`/api/categorias-integracao/${id}`)
    },
  },

  pedidos: {
    importar(data: SiggmaPedidoImportInput[]) {
      return siggmaRequest<{ type: 'success' }>('/api/pedidos-integracao/importar', {
        method: 'POST',
        body: JSON.stringify({ data }),
      })
    },
  },

  notas: {
    status(guidList: string[]) {
      return siggmaRequest<SiggmaFiscalStatusResponse>('/api/notas-saidas/status-notas', {
        method: 'POST',
        body: JSON.stringify({ data: guidList.map((guid) => ({ guid })) }),
      })
    },
  }
}
