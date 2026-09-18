export type SiggmaTokenResponse = {
  access_token: string
  token_type?: string
  expires_in?: number
  scope?: string
}

export type SiggmaApiWarning = {
  type: 'warning' | 'error'
  code?: number
  msg?: string
  detail?: string | null
}

export type SiggmaMetadata = {
  paginas: number
  pagina: number
  total?: number
}

export type SiggmaPage<T> = {
  metadata: SiggmaMetadata
  data: T[]
}

export type SiggmaPessoa = {
  id?: number
  tipo?: string
  nome?: string
  cpfcnpj?: string
  telefone?: string
  celular?: string
  email?: string
  endereco?: string
  numero?: string
  complemento?: string | null
  bairro?: string
  cep?: string
  municipio?: string
  uf?: string
  dataAtualizacao?: string
}

export type SiggmaCliente = {
  cliCod: number
  cliDoc?: string
  cliTpo?: string
  dataAtualizacao?: string
  pessoa?: SiggmaPessoa
  status?: {
    cliestCod?: number
    cliestDes?: string
    cliestBlock?: boolean
    inativar?: boolean
  }
}

export type SiggmaAnimal = {
  id: number
  nome?: string
  especie?: string | null
  raca?: string | null
  pelagem?: string | null
  porte?: string | null
  cor?: string | null
  condicao?: string | null
  comportamento?: string | null
  observacoes?: string | null
  status?: string | null
  imagem?: {
    type?: string
    imagems?: string
    imagemMin?: string | null
  } | null
  filial?: number | null
  dataAtualizacao?: string
  cliente?: SiggmaCliente | null
}

export type SiggmaVacina = {
  id: number
  intervaloDias?: number
  terceiros?: boolean
  dataHora?: string
  descricao?: string
  observacoes?: string | null
  animal?: number
  vacinaAnterior?: number | null
  status?: string
  dataAtualizacao?: string
}

export type SiggmaAtendimento = Record<string, unknown>

export type SiggmaProduto = {
  codigo_integracao?: number | string | null
  pro_cod: number
  codigo?: string
  gtin?: string
  nome?: string
  complemento?: string
  preco?: string
  estoque?: string
  valor_promocao?: string | null
  imagens?: string[]
  categorias?: number[]
  variacoes?: unknown[]
}
